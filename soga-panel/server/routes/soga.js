const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const SogaInstaller = require('../services/soga-installer');
const SSHService = require('../services/ssh');

const DATA_FILE = path.join(__dirname, '../../data/servers.json');

// 读取数据
const readData = async () => {
  const data = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(data);
};

// 写入数据
const writeData = async (data) => {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
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
      return res.status(500).json({ error: result.message });
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

    if (!server) {
      return res.status(404).json({ error: '服务器不存在' });
    }

    const installer = new SogaInstaller(server);
    const result = await installer.uninstall(instanceName);

    if (result.success) {
      // 从记录中删除
      const index = data.instances.findIndex(
        i => i.serverId === serverId && i.name === instanceName
      );
      if (index !== -1) {
        data.instances.splice(index, 1);
        await writeData(data);
      }
    }

    res.json({ success: result.success, message: result.message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
