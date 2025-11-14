const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const SogaInstaller = require('../services/soga-installer');
const SSHService = require('../services/ssh');

const DATA_FILE = path.join(__dirname, '../../data/servers.json');
const PACKAGES_DIR = path.join(__dirname, '../../data/offline-packages');
const PACKAGES_INDEX = path.join(__dirname, '../../data/offline-packages.json');

// 确保离线包目录存在
(async () => {
  try {
    await fs.mkdir(PACKAGES_DIR, { recursive: true });
    // 如果索引文件不存在，创建空数组
    try {
      await fs.access(PACKAGES_INDEX);
    } catch {
      await fs.writeFile(PACKAGES_INDEX, JSON.stringify([], null, 2));
    }
  } catch (error) {
    console.error('初始化离线包目录失败:', error);
  }
})();

// 读取数据
const readData = async () => {
  const data = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(data);
};

// 写入数据
const writeData = async (data) => {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
};

// 读取离线包索引
const readPackages = async () => {
  try {
    const data = await fs.readFile(PACKAGES_INDEX, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
};

// 写入离线包索引
const writePackages = async (packages) => {
  await fs.writeFile(PACKAGES_INDEX, JSON.stringify(packages, null, 2));
};

// 获取所有实例
router.get('/instances', async (req, res) => {
  try {
    const data = await readData();
    res.json({ instances: data.instances || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 安装 Soga 实例
router.post('/install', async (req, res) => {
  try {
    const { serverId, instanceName, config } = req.body;

    if (!serverId || !instanceName || !config) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const data = await readData();
    const server = data.servers.find(s => s.id === serverId);

    if (!server) {
      return res.status(404).json({ error: '服务器不存在' });
    }

    // 检查实例名称是否已存在
    const exists = data.instances.some(
      i => i.serverId === serverId && i.name === instanceName
    );
    if (exists) {
      return res.status(400).json({ error: '实例名称已存在' });
    }

    // 安装 Soga
    const installer = new SogaInstaller(server);
    const result = await installer.install(instanceName, config);

    if (!result.success) {
      return res.status(500).json({
        error: result.message,
        logs: result.logs // 返回安装日志
      });
    }

    // 保存实例信息
    const instance = {
      id: Date.now().toString(),
      serverId,
      name: instanceName,
      config,
      status: 'running',
      createdAt: new Date().toISOString()
    };

    if (!data.instances) {
      data.instances = [];
    }
    data.instances.push(instance);
    await writeData(data);

    res.json({ success: true, instance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取实例状态
router.get('/:serverId/:instanceName/status', async (req, res) => {
  try {
    const { serverId, instanceName } = req.params;
    const data = await readData();
    const server = data.servers.find(s => s.id === serverId);

    if (!server) {
      return res.status(404).json({ error: '服务器不存在' });
    }

    const ssh = new SSHService(server);
    const status = await ssh.getServiceStatus(instanceName);

    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 启动实例
router.post('/:serverId/:instanceName/start', async (req, res) => {
  try {
    const { serverId, instanceName } = req.params;
    const data = await readData();
    const server = data.servers.find(s => s.id === serverId);

    if (!server) {
      return res.status(404).json({ error: '服务器不存在' });
    }

    const ssh = new SSHService(server);
    const result = await ssh.startService(instanceName);

    res.json({ success: result.success, message: result.message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 停止实例
router.post('/:serverId/:instanceName/stop', async (req, res) => {
  try {
    const { serverId, instanceName } = req.params;
    const data = await readData();
    const server = data.servers.find(s => s.id === serverId);

    if (!server) {
      return res.status(404).json({ error: '服务器不存在' });
    }

    const ssh = new SSHService(server);
    const result = await ssh.stopService(instanceName);

    res.json({ success: result.success, message: result.message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 重启实例
router.post('/:serverId/:instanceName/restart', async (req, res) => {
  try {
    const { serverId, instanceName } = req.params;
    const data = await readData();
    const server = data.servers.find(s => s.id === serverId);

    if (!server) {
      return res.status(404).json({ error: '服务器不存在' });
    }

    const ssh = new SSHService(server);
    const result = await ssh.restartService(instanceName);

    res.json({ success: result.success, message: result.message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取实例日志
router.get('/:serverId/:instanceName/logs', async (req, res) => {
  try {
    const { serverId, instanceName } = req.params;
    const lines = req.query.lines || 100;
    const data = await readData();
    const server = data.servers.find(s => s.id === serverId);

    if (!server) {
      return res.status(404).json({ error: '服务器不存在' });
    }

    const ssh = new SSHService(server);
    const logs = await ssh.getServiceLogs(instanceName, lines);

    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新实例配置
router.put('/:serverId/:instanceName/config', async (req, res) => {
  try {
    const { serverId, instanceName } = req.params;
    const { config } = req.body;

    if (!config) {
      return res.status(400).json({ error: '缺少配置参数' });
    }

    const data = await readData();
    const server = data.servers.find(s => s.id === serverId);

    if (!server) {
      return res.status(404).json({ error: '服务器不存在' });
    }

    const installer = new SogaInstaller(server);
    const result = await installer.updateConfig(instanceName, config);

    if (result.success) {
      // 更新本地记录
      const instance = data.instances.find(
        i => i.serverId === serverId && i.name === instanceName
      );
      if (instance) {
        instance.config = config;
        instance.updatedAt = new Date().toISOString();
        await writeData(data);
      }
    }

    res.json({ success: result.success, message: result.message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新 Soga 版本
router.post('/:serverId/:instanceName/update', async (req, res) => {
  try {
    const { serverId, instanceName } = req.params;
    const { config } = req.body;

    const data = await readData();
    const server = data.servers.find(s => s.id === serverId);

    if (!server) {
      return res.status(404).json({ error: '服务器不存在' });
    }

    const installer = new SogaInstaller(server);
    const result = await installer.updateSoga(instanceName, config || {});

    if (result.success) {
      // 更新本地记录
      const instance = data.instances.find(
        i => i.serverId === serverId && i.name === instanceName
      );
      if (instance) {
        instance.updatedAt = new Date().toISOString();
        await writeData(data);
      }
    }

    res.json({ success: result.success, message: result.message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除实例
router.delete('/:serverId/:instanceName', async (req, res) => {
  try {
    const { serverId, instanceName } = req.params;
    const data = await readData();
    const server = data.servers.find(s => s.id === serverId);

    // 如果服务器存在，尝试在服务器上卸载
    if (server) {
      const installer = new SogaInstaller(server);
      const result = await installer.uninstall(instanceName);

      if (!result.success) {
        console.warn(`服务器端卸载失败: ${result.message}，但仍会删除本地记录`);
      }
    } else {
      console.warn(`服务器不存在 (ID: ${serverId})，仅删除本地实例记录`);
    }

    // 无论服务器是否存在，都删除本地记录
    const index = data.instances.findIndex(
      i => i.serverId === serverId && i.name === instanceName
    );

    if (index !== -1) {
      data.instances.splice(index, 1);
      await writeData(data);
      res.json({
        success: true,
        message: server ? '实例删除成功' : '实例记录已删除（服务器不存在）'
      });
    } else {
      res.status(404).json({ error: '实例不存在' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 离线包管理 ====================

// 获取所有离线包
router.get('/packages', async (req, res) => {
  try {
    const packages = await readPackages();
    res.json({ success: true, packages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 上传离线包并保存
router.post('/packages', async (req, res) => {
  try {
    const { name, arch, fileBase64, description } = req.body;

    if (!name || !arch || !fileBase64) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 检查名称是否已存在
    const packages = await readPackages();
    if (packages.some(p => p.name === name)) {
      return res.status(400).json({ error: '该名称的离线包已存在' });
    }

    // 保存文件
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const fileName = `${name}-${arch}-${Date.now()}.tar.gz`;
    const filePath = path.join(PACKAGES_DIR, fileName);

    await fs.writeFile(filePath, fileBuffer);

    // 添加到索引
    const packageInfo = {
      id: Date.now().toString(),
      name,
      arch,
      fileName,
      size: fileBuffer.length,
      description: description || '',
      createdAt: new Date().toISOString()
    };

    packages.push(packageInfo);
    await writePackages(packages);

    res.json({ success: true, package: packageInfo });
  } catch (error) {
    console.error('上传离线包失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 删除离线包
router.delete('/packages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const packages = await readPackages();

    const index = packages.findIndex(p => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: '离线包不存在' });
    }

    const pkg = packages[index];

    // 删除文件
    try {
      await fs.unlink(path.join(PACKAGES_DIR, pkg.fileName));
    } catch (error) {
      console.warn('删除文件失败:', error.message);
    }

    // 从索引中删除
    packages.splice(index, 1);
    await writePackages(packages);

    res.json({ success: true, message: '离线包删除成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取离线包文件内容（用于安装）
router.get('/packages/:id/content', async (req, res) => {
  try {
    const { id } = req.params;
    const packages = await readPackages();

    const pkg = packages.find(p => p.id === id);
    if (!pkg) {
      return res.status(404).json({ error: '离线包不存在' });
    }

    const filePath = path.join(PACKAGES_DIR, pkg.fileName);
    const fileBuffer = await fs.readFile(filePath);
    const base64Content = fileBuffer.toString('base64');

    res.json({ success: true, content: base64Content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
