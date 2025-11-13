const SSHService = require('./ssh');
const ConfigGenerator = require('../utils/config-generator');

class SogaInstaller {
  constructor(serverConfig) {
    this.ssh = new SSHService(serverConfig);
    this.configGenerator = new ConfigGenerator();
  }

  // 安装 Soga
  async install(instanceName, config) {
    try {
      console.log(`开始安装 Soga 实例: ${instanceName}`);

      // 1. 连接服务器
      await this.ssh.connect();

      // 2. 检测系统架构
      const archResult = await this.ssh.execCommand('uname -m');
      const arch = archResult.stdout.trim();
      const sogaArch = this.getArch(arch);

      console.log(`系统架构: ${arch} -> ${sogaArch}`);

      // 3. 创建工作目录
      const workDir = `/etc/soga/${instanceName}`;
      await this.ssh.execCommand(`mkdir -p ${workDir}`);

      // 4. 下载或上传 Soga
      if (config.offlineMode && config.sogaPackage) {
        // 离线模式：上传用户提供的 tar.gz 包
        console.log('使用离线授权模式...');
        await this.installOffline(workDir, config.sogaPackage);
      } else {
        // 在线模式：从 GitHub 下载
        console.log('使用在线授权模式...');
        const sogaVersion = config.sogaVersion || 'latest';
        const downloadUrl = this.getDownloadUrl(sogaVersion, sogaArch);
        await this.installOnline(workDir, downloadUrl);
      }

      // 5. 生成并上传配置文件
      await this.uploadConfigs(instanceName, workDir, config);

      // 6. 创建 systemd 服务
      await this.createSystemdService(instanceName, workDir);

      // 7. 启动服务
      const serviceName = `soga-${instanceName}`;
      await this.ssh.execCommand(`systemctl daemon-reload`);
      await this.ssh.execCommand(`systemctl enable ${serviceName}`);
      await this.ssh.execCommand(`systemctl start ${serviceName}`);

      this.ssh.dispose();

      console.log(`Soga 实例 ${instanceName} 安装成功`);
      return { success: true, message: '安装成功' };

    } catch (error) {
      console.error(`安装失败: ${error.message}`);
      this.ssh.dispose();
      return { success: false, message: error.message };
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

    const downloadCmd = `
      cd /tmp && \\
      rm -f soga soga-* && \\
      wget --timeout=60 --tries=3 -O soga "${downloadUrl}" 2>&1 && \\
      chmod +x soga && \\
      mv soga ${workDir}/soga
    `;
    
    const downloadResult = await this.ssh.execCommand(downloadCmd);
    if (downloadResult.code !== 0) {
      console.error('下载失败，输出：', downloadResult.stdout);
      console.error('错误信息：', downloadResult.stderr);
      throw new Error(`下载失败: ${downloadResult.stderr || downloadResult.stdout || '未知错误'}`);
    }

    // 验证文件是否存在且可执行
    const verifyResult = await this.ssh.execCommand(`test -x ${workDir}/soga && echo "OK"`);
    if (verifyResult.stdout.trim() !== 'OK') {
      throw new Error('Soga 文件下载失败或无法执行');
    }

    console.log('Soga 下载成功');
  }

  // 离线安装
  async installOffline(workDir, packageBase64) {
    console.log('上传离线 Soga 包...');
    
    // 上传 tar.gz 包
    const uploadCmd = `
      cd /tmp && \\
      echo "${packageBase64}" | base64 -d > soga.tar.gz && \\
      tar -xzf soga.tar.gz && \\
      chmod +x soga && \\
      mv soga ${workDir}/soga && \\
      rm -f soga.tar.gz
    `;
    
    const uploadResult = await this.ssh.execCommand(uploadCmd);
    if (uploadResult.code !== 0) {
      throw new Error(`离线包安装失败: ${uploadResult.stderr || '未知错误'}`);
    }

    // 验证文件
    const verifyResult = await this.ssh.execCommand(`test -x ${workDir}/soga && echo "OK"`);
    if (verifyResult.stdout.trim() !== 'OK') {
      throw new Error('Soga 文件解压失败或无法执行');
    }

    console.log('离线包安装成功');
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
    const baseUrl = 'https://github.com/sprov065/soga/releases';
    
    if (version === 'latest') {
      return `${baseUrl}/latest/download/soga-linux-${arch}`;
    } else {
      return `${baseUrl}/download/${version}/soga-linux-${arch}`;
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
