const SSHService = require('./ssh');
const ConfigGenerator = require('../utils/config-generator');

class SogaInstaller {
  constructor(serverConfig) {
    this.ssh = new SSHService(serverConfig);
    this.configGenerator = new ConfigGenerator();
    this.installLogs = []; // 捕获安装日志
  }

  // 添加日志
  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    this.installLogs.push(logEntry);
    console.log(logEntry);
  }

  // 获取日志
  getLogs() {
    return this.installLogs.join('\n');
  }

  // 清空日志
  clearLogs() {
    this.installLogs = [];
  }

  // 安装 Soga
  async install(instanceName, config) {
    this.clearLogs(); // 清空之前的日志

    try {
      this.log(`开始安装 Soga 实例: ${instanceName}`, 'info');

      // 1. 连接服务器
      this.log('连接到服务器...', 'info');
      await this.ssh.connect();
      this.log('服务器连接成功', 'success');

      // 2. 检测系统架构
      this.log('检测系统架构...', 'info');
      const archResult = await this.ssh.execCommand('uname -m');
      const arch = archResult.stdout.trim();
      const sogaArch = this.getArch(arch);
      this.log(`系统架构: ${arch} -> ${sogaArch}`, 'info');

      // 3. 创建工作目录
      const workDir = `/etc/soga/${instanceName}`;
      this.log(`创建工作目录: ${workDir}`, 'info');
      await this.ssh.execCommand(`mkdir -p ${workDir}`);

      // 4. 下载或上传 Soga
      if (config.offlineMode && config.sogaPackage) {
        // 离线模式：上传用户提供的 tar.gz 包
        this.log('使用离线授权模式...', 'info');
        await this.installOffline(workDir, config.sogaPackage);
      } else {
        // 在线模式：从 GitHub 下载
        this.log('使用在线授权模式...', 'info');
        const sogaVersion = config.sogaVersion || 'latest';
        const downloadUrl = this.getDownloadUrl(sogaVersion, sogaArch);
        await this.installOnline(workDir, downloadUrl);
      }

      // 5. 生成并上传配置文件
      this.log('生成并上传配置文件...', 'info');
      await this.uploadConfigs(instanceName, workDir, config);

      // 6. 创建 systemd 服务
      this.log('创建 systemd 服务...', 'info');
      await this.createSystemdService(instanceName, workDir);

      // 7. 启动服务
      const serviceName = `soga-${instanceName}`;
      this.log('启动 Soga 服务...', 'info');
      await this.ssh.execCommand(`systemctl daemon-reload`);
      await this.ssh.execCommand(`systemctl enable ${serviceName}`);
      const startResult = await this.ssh.execCommand(`systemctl start ${serviceName}`);

      if (startResult.code !== 0) {
        this.log(`服务启动警告: ${startResult.stderr}`, 'warn');
      } else {
        this.log('服务启动成功', 'success');
      }

      this.ssh.dispose();

      this.log(`Soga 实例 ${instanceName} 安装成功`, 'success');
      return { success: true, message: '安装成功', logs: this.getLogs() };

    } catch (error) {
      this.log(`安装失败: ${error.message}`, 'error');
      this.ssh.dispose();
      return {
        success: false,
        message: error.message,
        logs: this.getLogs() // 返回完整的日志
      };
    }
  }

  // 在线安装
  async installOnline(workDir, downloadUrl) {
    console.log(`下载 Soga: ${downloadUrl}`);

    // 先测试网络连接
    const testResult = await this.ssh.execCommand('curl -I https://github.com --connect-timeout 10');
    if (testResult.code !== 0) {
      throw new Error('无法连接到 GitHub，请检查网络或使用离线模式');
    }

    // 下载并解压 tar.gz 包（参考官方脚本）
    const downloadCmd = `
      cd /usr/local && \\
      rm -f soga.tar.gz soga && \\
      wget -N --no-check-certificate -O soga.tar.gz "${downloadUrl}" 2>&1 && \\
      echo "下载完成，开始解压..." && \\
      tar zxvf soga.tar.gz 2>&1 && \\
      ls -lh soga && \\
      chmod +x soga && \\
      mkdir -p ${workDir} && \\
      mv soga ${workDir}/soga && \\
      chmod +x ${workDir}/soga && \\
      rm -f soga.tar.gz
    `;

    const downloadResult = await this.ssh.execCommand(downloadCmd);
    console.log('=== 下载步骤 ===');
    console.log('退出码:', downloadResult.code);
    console.log('输出:', downloadResult.stdout);
    if (downloadResult.stderr) console.log('错误:', downloadResult.stderr);

    if (downloadResult.code !== 0) {
      throw new Error(`下载失败: ${downloadResult.stderr || downloadResult.stdout || '未知错误'}`);
    }

    // 验证文件是否存在且可执行
    const verifyResult = await this.ssh.execCommand(`test -x ${workDir}/soga && echo "OK" || echo "FAIL"`);
    console.log('=== 验证步骤 ===');
    console.log('验证结果:', verifyResult.stdout.trim());

    if (verifyResult.stdout.trim() !== 'OK') {
      // 获取详细信息
      const debugInfo = await this.ssh.execCommand(`ls -lh ${workDir}/soga 2>&1 && file ${workDir}/soga 2>&1`);
      console.log('调试信息:', debugInfo.stdout);

      // 尝试修复权限
      console.log('尝试修复权限...');
      const fixResult = await this.ssh.execCommand(`chmod +x ${workDir}/soga && ls -lh ${workDir}/soga`);
      console.log('修复结果:', fixResult.stdout);

      // 再次验证
      const retryVerify = await this.ssh.execCommand(`test -x ${workDir}/soga && echo "OK" || echo "FAIL"`);
      if (retryVerify.stdout.trim() !== 'OK') {
        throw new Error(`Soga 文件无法执行，权限修复失败: ${debugInfo.stdout}`);
      }
      console.log('权限修复成功');
    }

    console.log('Soga 下载成功');
  }

  // 离线安装（参考官方脚本，使用 SFTP 上传）
  async installOffline(workDir, packageBase64) {
    this.log('上传离线 Soga 包...', 'info');
    this.log(`Base64 数据长度: ${packageBase64.length}`, 'info');

    // 步骤1: 使用 SFTP 上传文件到 /usr/local（与官方脚本路径一致）
    const remotePath = '/usr/local/soga.tar.gz';

    // 清理旧文件
    this.log('清理旧文件...', 'info');
    const cleanResult = await this.ssh.execCommand('rm -f /usr/local/soga.tar.gz /usr/local/soga');
    if (cleanResult.code !== 0) {
      this.log(`清理警告: ${cleanResult.stderr}`, 'warn');
    }

    // 将 base64 转换为 Buffer
    const fileBuffer = Buffer.from(packageBase64, 'base64');
    this.log(`文件大小: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`, 'info');

    // 使用 SFTP 上传（设置读写权限）
    try {
      this.log('=== 步骤1: 上传文件 ===', 'info');
      await this.ssh.uploadFile(fileBuffer, remotePath, { mode: '644' });
      this.log('SFTP 上传成功', 'success');
    } catch (error) {
      this.log(`文件上传失败: ${error.message}`, 'error');
      throw new Error(`文件上传失败: ${error.message}`);
    }

    // 验证上传的文件
    this.log('验证上传的文件...', 'info');
    const verifyUpload = await this.ssh.execCommand(`ls -lh ${remotePath} && file ${remotePath}`);
    this.log(`文件验证输出:\n${verifyUpload.stdout}`, 'info');

    if (verifyUpload.code !== 0) {
      this.log(`文件上传验证失败: ${verifyUpload.stderr || '文件不存在'}`, 'error');
      throw new Error(`文件上传验证失败: ${verifyUpload.stderr || '文件不存在'}`);
    }

    // 判断是否为 tar.gz 压缩包
    const fileTypeOutput = verifyUpload.stdout;
    const isTarGz = fileTypeOutput.includes('gzip') || fileTypeOutput.includes('compressed');
    this.log(`文件类型: ${isTarGz ? 'tar.gz 压缩包' : '可能是二进制文件'}`, 'info');

    // 步骤2: 解压或处理文件
    let extractCmd;
    if (isTarGz) {
      // tar.gz 包：使用官方脚本的解压方式
      this.log('=== 步骤2: 解压/安装 ===', 'info');
      this.log('开始解压 tar.gz 包（使用官方脚本方式）...', 'info');
      extractCmd = `
        cd /usr/local && \\
        echo "开始解压..." && \\
        tar zxvf soga.tar.gz 2>&1 && \\
        echo "解压完成" && \\
        ls -lh soga && \\
        chmod +x soga && \\
        mkdir -p ${workDir} && \\
        mv soga ${workDir}/soga && \\
        chmod +x ${workDir}/soga && \\
        rm -f soga.tar.gz && \\
        echo "安装完成"
      `;
    } else {
      // 二进制文件：重命名并处理
      this.log('=== 步骤2: 解压/安装 ===', 'info');
      this.log('作为二进制文件处理...', 'info');
      extractCmd = `
        cd /usr/local && \\
        mv soga.tar.gz soga && \\
        echo "重命名完成" && \\
        ls -lh soga && \\
        chmod +x soga && \\
        mkdir -p ${workDir} && \\
        mv soga ${workDir}/soga && \\
        chmod +x ${workDir}/soga && \\
        echo "安装完成"
      `;
    }

    const extractResult = await this.ssh.execCommand(extractCmd);
    this.log(`退出码: ${extractResult.code}`, extractResult.code === 0 ? 'success' : 'error');
    this.log(`输出:\n${extractResult.stdout}`, 'info');
    if (extractResult.stderr) {
      this.log(`stderr:\n${extractResult.stderr}`, 'warn');
    }

    if (extractResult.code !== 0) {
      const errorMsg = extractResult.stderr || extractResult.stdout || '未知错误';
      this.log(`安装失败: ${errorMsg}`, 'error');
      throw new Error(`离线包安装失败: ${errorMsg}`);
    }

    // 确保文件权限正确（额外保险）
    this.log('=== 额外步骤: 确保权限 ===', 'info');
    const ensurePermResult = await this.ssh.execCommand(`chmod +x ${workDir}/soga && ls -lh ${workDir}/soga`);
    this.log(`权限确认:\n${ensurePermResult.stdout}`, 'info');

    // 步骤3: 验证文件是否存在且可执行
    this.log('=== 步骤3: 验证安装 ===', 'info');
    const verifyResult = await this.ssh.execCommand(`test -x ${workDir}/soga && echo "OK" || echo "FAIL"`);
    this.log(`验证结果: ${verifyResult.stdout.trim()}`, 'info');

    if (verifyResult.stdout.trim() !== 'OK') {
      // 获取详细信息用于调试
      this.log('验证失败，获取调试信息...', 'warn');
      const debugInfo = await this.ssh.execCommand(`ls -lh ${workDir}/soga 2>&1 && file ${workDir}/soga 2>&1`);
      this.log(`调试信息:\n${debugInfo.stdout}`, 'info');

      // 尝试修复权限
      this.log('尝试修复权限...', 'warn');
      const fixResult = await this.ssh.execCommand(`chmod +x ${workDir}/soga && ls -lh ${workDir}/soga`);
      this.log(`修复结果:\n${fixResult.stdout}`, 'info');

      // 再次验证
      const retryVerify = await this.ssh.execCommand(`test -x ${workDir}/soga && echo "OK" || echo "FAIL"`);
      if (retryVerify.stdout.trim() !== 'OK') {
        this.log(`Soga 文件无法执行，权限修复失败`, 'error');
        throw new Error(`Soga 文件无法执行，权限修复失败: ${debugInfo.stdout}`);
      }
      this.log('权限修复成功', 'success');
    }

    this.log('离线包安装成功！', 'success');
  }

  // 更新 Soga 版本
  async updateSoga(instanceName, config) {
    try {
      console.log(`更新 Soga 实例: ${instanceName}`);

      await this.ssh.connect();
      const workDir = `/etc/soga/${instanceName}`;
      const serviceName = `soga-${instanceName}`;

      // 停止服务
      await this.ssh.execCommand(`systemctl stop ${serviceName}`);

      // 备份旧版本
      await this.ssh.execCommand(`cp ${workDir}/soga ${workDir}/soga.backup`);

      // 检测架构
      const archResult = await this.ssh.execCommand('uname -m');
      const arch = archResult.stdout.trim();
      const sogaArch = this.getArch(arch);

      // 下载新版本
      if (config.offlineMode && config.sogaPackage) {
        await this.installOffline(workDir, config.sogaPackage);
      } else {
        const sogaVersion = config.sogaVersion || 'latest';
        const downloadUrl = this.getDownloadUrl(sogaVersion, sogaArch);
        await this.installOnline(workDir, downloadUrl);
      }

      // 重启服务
      await this.ssh.execCommand(`systemctl start ${serviceName}`);

      this.ssh.dispose();

      console.log(`Soga 更新成功: ${instanceName}`);
      return { success: true, message: 'Soga 更新成功' };

    } catch (error) {
      console.error(`更新失败: ${error.message}`);
      // 尝试恢复备份
      await this.ssh.execCommand(`mv ${workDir}/soga.backup ${workDir}/soga`);
      await this.ssh.execCommand(`systemctl start soga-${instanceName}`);
      this.ssh.dispose();
      return { success: false, message: error.message };
    }
  }

  // 更新配置
  async updateConfig(instanceName, config) {
    try {
      console.log(`更新 Soga 实例配置: ${instanceName}`);

      await this.ssh.connect();
      const workDir = `/etc/soga/${instanceName}`;

      // 上传新配置
      await this.uploadConfigs(instanceName, workDir, config);

      // 重启服务
      const serviceName = `soga-${instanceName}`;
      await this.ssh.execCommand(`systemctl restart ${serviceName}`);

      this.ssh.dispose();

      console.log(`配置更新成功: ${instanceName}`);
      return { success: true, message: '配置更新成功' };

    } catch (error) {
      console.error(`配置更新失败: ${error.message}`);
      this.ssh.dispose();
      return { success: false, message: error.message };
    }
  }

  // 卸载 Soga
  async uninstall(instanceName) {
    try {
      console.log(`卸载 Soga 实例: ${instanceName}`);

      await this.ssh.connect();
      const serviceName = `soga-${instanceName}`;
      const workDir = `/etc/soga/${instanceName}`;

      // 停止并禁用服务
      await this.ssh.execCommand(`systemctl stop ${serviceName}`);
      await this.ssh.execCommand(`systemctl disable ${serviceName}`);

      // 删除服务文件
      await this.ssh.execCommand(`rm -f /etc/systemd/system/${serviceName}.service`);
      await this.ssh.execCommand(`systemctl daemon-reload`);

      // 删除工作目录
      await this.ssh.execCommand(`rm -rf ${workDir}`);

      this.ssh.dispose();

      console.log(`Soga 实例 ${instanceName} 卸载成功`);
      return { success: true, message: '卸载成功' };

    } catch (error) {
      console.error(`卸载失败: ${error.message}`);
      this.ssh.dispose();
      return { success: false, message: error.message };
    }
  }

  // 上传配置文件
  async uploadConfigs(instanceName, workDir, config) {
    // 生成 soga.conf
    const sogaConf = this.configGenerator.generateSogaConf(config);
    await this.ssh.execCommand(`cat > ${workDir}/soga.conf << 'EOFMARKER'\n${sogaConf}\nEOFMARKER`);

    // 生成 route.toml
    if (config.routeConfig) {
      const routeToml = this.configGenerator.generateRouteToml(config.routeConfig);
      await this.ssh.execCommand(`cat > ${workDir}/route.toml << 'EOFMARKER'\n${routeToml}\nEOFMARKER`);
    }

    // 生成 blocklist
    if (config.blockList) {
      const blockList = this.configGenerator.generateBlockList(config.blockList);
      await this.ssh.execCommand(`cat > ${workDir}/blocklist << 'EOFMARKER'\n${blockList}\nEOFMARKER`);
    }

    // 上传证书文件（如果有）
    if (config.certFile) {
      await this.ssh.execCommand(`cat > ${workDir}/cert.pem << 'EOFMARKER'\n${config.certFile}\nEOFMARKER`);
    }

    if (config.keyFile) {
      await this.ssh.execCommand(`cat > ${workDir}/key.pem << 'EOFMARKER'\n${config.keyFile}\nEOFMARKER`);
    }
  }

  // 创建 systemd 服务
  async createSystemdService(instanceName, workDir) {
    const serviceName = `soga-${instanceName}`;
    const serviceContent = `[Unit]
Description=Soga Service - ${instanceName}
After=network.target nss-lookup.target
Wants=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${workDir}
ExecStart=${workDir}/soga -c ${workDir}/soga.conf
Restart=on-failure
RestartSec=10s
LimitNOFILE=1000000

[Install]
WantedBy=multi-user.target
`;

    await this.ssh.execCommand(
      `cat > /etc/systemd/system/${serviceName}.service << 'EOFMARKER'\n${serviceContent}\nEOFMARKER`
    );
  }

  // 获取下载地址
  getDownloadUrl(version, arch) {
    const baseUrl = 'https://github.com/vaxilu/soga/releases';

    // 架构名称映射（tar.gz 文件使用的名称）
    const archNameMap = {
      'amd64': 'amd',
      'arm64': 'arm64',
      'armv7': 'armv7',
      '386': '386'
    };

    const archName = archNameMap[arch] || 'amd';

    if (version === 'latest') {
      return `${baseUrl}/latest/download/soga-linux-${archName}.tar.gz`;
    } else {
      return `${baseUrl}/download/${version}/soga-linux-${archName}.tar.gz`;
    }
  }

  // 转换架构名称
  getArch(arch) {
    const archMap = {
      'x86_64': 'amd64',
      'aarch64': 'arm64',
      'armv7l': 'armv7',
      'i686': '386'
    };
    return archMap[arch] || 'amd64';
  }
}

module.exports = SogaInstaller;
