const SSH2Promise = require('ssh2-promise');

class SSHService {
  constructor(serverConfig) {
    this.config = serverConfig;
    this.ssh = null;
  }

  // 连接到服务器
  async connect() {
    const config = {
      host: this.config.host,
      port: this.config.port || 22,
      username: this.config.username
    };

    if (this.config.password) {
      config.password = this.config.password;
    } else if (this.config.privateKey) {
      config.privateKey = this.config.privateKey;
    }

    this.ssh = new SSH2Promise(config);
    await this.ssh.connect();
  }

  // 执行命令
  async execCommand(command) {
    if (!this.ssh) {
      throw new Error('SSH 未连接');
    }

    try {
      const result = await this.ssh.exec(command);
      return {
        code: 0,
        stdout: result,
        stderr: ''
      };
    } catch (error) {
      return {
        code: 1,
        stdout: '',
        stderr: error.message
      };
    }
  }

  // 关闭连接
  dispose() {
    if (this.ssh) {
      this.ssh.close();
      this.ssh = null;
    }
  }

  // 测试连接
  async testConnection() {
    try {
      await this.connect();
      await this.execCommand('echo "connected"');
      this.dispose();
      return { 
        success: true, 
        message: '连接成功' 
      };
    } catch (error) {
      return { 
        success: false, 
        message: `连接失败: ${error.message}` 
      };
    }
  }

  // 获取系统信息
  async getSystemInfo() {
    await this.connect();
    
    const commands = {
      os: 'cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d \'"\'',
      kernel: 'uname -r',
      arch: 'uname -m',
      cpu: 'cat /proc/cpuinfo | grep "model name" | head -1 | cut -d: -f2 | xargs',
      memory: 'free -h | grep Mem | awk \'{print $2}\'',
      disk: 'df -h / | tail -1 | awk \'{print $2}\''
    };

    const info = {};
    for (const [key, cmd] of Object.entries(commands)) {
      const result = await this.execCommand(cmd);
      info[key] = result.stdout.trim();
    }

    this.dispose();
    return info;
  }

  // 获取服务状态
  async getServiceStatus(instanceName) {
    await this.connect();
    const serviceName = `soga-${instanceName}`;
    const result = await this.execCommand(`systemctl is-active ${serviceName}`);
    const status = result.stdout.trim();
    
    // 获取详细状态
    const detailResult = await this.execCommand(`systemctl status ${serviceName} --no-pager`);
    
    this.dispose();
    return {
      active: status === 'active',
      status: status,
      details: detailResult.stdout
    };
  }

  // 启动服务
  async startService(instanceName) {
    await this.connect();
    const serviceName = `soga-${instanceName}`;
    const result = await this.execCommand(`systemctl start ${serviceName}`);
    this.dispose();
    
    if (result.code === 0) {
      return { success: true, message: '服务启动成功' };
    } else {
      return { success: false, message: result.stderr };
    }
  }

  // 停止服务
  async stopService(instanceName) {
    await this.connect();
    const serviceName = `soga-${instanceName}`;
    const result = await this.execCommand(`systemctl stop ${serviceName}`);
    this.dispose();
    
    if (result.code === 0) {
      return { success: true, message: '服务停止成功' };
    } else {
      return { success: false, message: result.stderr };
    }
  }

  // 重启服务
  async restartService(instanceName) {
    await this.connect();
    const serviceName = `soga-${instanceName}`;
    const result = await this.execCommand(`systemctl restart ${serviceName}`);
    this.dispose();
    
    if (result.code === 0) {
      return { success: true, message: '服务重启成功' };
    } else {
      return { success: false, message: result.stderr };
    }
  }

  // 获取服务日志
  async getServiceLogs(instanceName, lines = 100) {
    await this.connect();
    const serviceName = `soga-${instanceName}`;
    const result = await this.execCommand(
      `journalctl -u ${serviceName} -n ${lines} --no-pager`
    );
    this.dispose();
    return result.stdout;
  }

  // 上传文件 (使用 SFTP)
  async uploadFile(localBuffer, remotePath, options = {}) {
    if (!this.ssh) {
      throw new Error('SSH 未连接');
    }

    try {
      const sftp = this.ssh.sftp();

      // 确保远程目录存在
      const remoteDir = remotePath.substring(0, remotePath.lastIndexOf('/'));
      await this.execCommand(`mkdir -p ${remoteDir}`);

      // 上传文件
      await sftp.writeFile(remotePath, localBuffer);
      console.log(`文件上传成功: ${remotePath}`);

      // 上传后设置权限（如果指定）
      if (options.mode) {
        await this.execCommand(`chmod ${options.mode} ${remotePath}`);
        console.log(`设置文件权限: ${options.mode}`);
      }

      return { success: true, path: remotePath };
    } catch (error) {
      console.error('文件上传失败:', error);
      throw new Error(`文件上传失败: ${error.message}`);
    }
  }
}

module.exports = SSHService;
