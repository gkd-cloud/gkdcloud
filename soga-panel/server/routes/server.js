const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
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

// 获取所有服务器
router.get('/', async (req, res) => {
  try {
    const data = await readData();
    res.json({ servers: data.servers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加服务器
router.post('/', async (req, res) => {
  try {
    const { name, host, port, username, password, privateKey } = req.body;

    if (!name || !host || !username) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const data = await readData();
    const serverId = Date.now().toString();

    const server = {
      id: serverId,
      name,
      host,
      port: port || 22,
      username,
      password: password || null,
      privateKey: privateKey || null,
      createdAt: new Date().toISOString()
    };

    data.servers.push(server);
    await writeData(data);

    res.json({ success: true, server });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 测试服务器连接
router.post('/:id/test', async (req, res) => {
  try {
    const data = await readData();
    const server = data.servers.find(s => s.id === req.params.id);

    if (!server) {
      return res.status(404).json({ error: '服务器不存在' });
    }

    const ssh = new SSHService(server);
    const result = await ssh.testConnection();

    res.json({ success: result.success, message: result.message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取服务器信息
router.get('/:id/info', async (req, res) => {
  try {
    const data = await readData();
    const server = data.servers.find(s => s.id === req.params.id);

    if (!server) {
      return res.status(404).json({ error: '服务器不存在' });
    }

    const ssh = new SSHService(server);
    const info = await ssh.getSystemInfo();

    res.json({ success: true, info });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除服务器
router.delete('/:id', async (req, res) => {
  try {
    const data = await readData();
    const index = data.servers.findIndex(s => s.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: '服务器不存在' });
    }

    // 检查是否有关联的实例
    const hasInstances = data.instances.some(i => i.serverId === req.params.id);
    if (hasInstances) {
      return res.status(400).json({
        error: '该服务器上还有 Soga 实例，请先删除所有实例'
      });
    }

    data.servers.splice(index, 1);
    await writeData(data);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 运行 Soga 诊断脚本
router.post('/:id/diagnose/:instanceName?', async (req, res) => {
  try {
    const data = await readData();
    const server = data.servers.find(s => s.id === req.params.id);

    if (!server) {
      return res.status(404).json({ error: '服务器不存在' });
    }

    const instanceName = req.params.instanceName || 'soga-test';

    // 读取诊断脚本
    const scriptPath = path.join(__dirname, '../../diagnose-soga.sh');
    const scriptContent = await fs.readFile(scriptPath, 'utf8');

    const ssh = new SSHService(server);
    await ssh.connect();

    // 上传并执行诊断脚本
    const remotePath = '/tmp/diagnose-soga.sh';
    await ssh.uploadFile(Buffer.from(scriptContent), remotePath, { mode: '755' });

    // 执行诊断脚本
    const result = await ssh.execCommand(`bash ${remotePath} ${instanceName}`);

    ssh.dispose();

    res.json({
      success: true,
      output: result.stdout,
      error: result.stderr,
      exitCode: result.code
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
