const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

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

// 获取所有模板
router.get('/', async (req, res) => {
  try {
    const data = await readData();
    res.json({ success: true, templates: data.templates || [] });
  } catch (error) {
    console.error('获取模板失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建模板
router.post('/', async (req, res) => {
  try {
    const { name, description, config } = req.body;

    if (!name || !config) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    const data = await readData();
    if (!data.templates) {
      data.templates = [];
    }

    const templateId = Date.now().toString();
    const newTemplate = {
      id: templateId,
      name,
      description: description || '',
      config: {
        // 基础配置
        panelType: config.panelType,
        serverType: config.serverType,
        sogaKey: config.sogaKey,
        api: config.api,
        // WebAPI 对接配置
        panelUrl: config.panelUrl,
        panelKey: config.panelKey,
        // 数据库对接配置
        dbHost: config.dbHost,
        dbPort: config.dbPort,
        dbName: config.dbName,
        dbUser: config.dbUser,
        dbPassword: config.dbPassword,
        // DNS 配置
        defaultDns: config.defaultDns,
        dnsCacheTime: config.dnsCacheTime,
        dnsStrategy: config.dnsStrategy,
        dnsType: config.dnsType,
        enableDNS: config.enableDNS,
        dnsListenPort: config.dnsListenPort,
        // 日志配置
        logLevel: config.logLevel,
        logFile: config.logFile,
        // 其他配置
        enableProxyProtocol: config.enableProxyProtocol,
        checkInterval: config.checkInterval,
        userConnLimit: config.userConnLimit,
        userSpeedLimit: config.userSpeedLimit,
        // 路由配置
        routeConfig: config.routeConfig,
        blockList: config.blockList
      },
      createdAt: new Date().toISOString()
    };

    data.templates.push(newTemplate);
    await writeData(data);

    res.json({ success: true, template: newTemplate });
  } catch (error) {
    console.error('创建模板失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新模板
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, config } = req.body;

    const data = await readData();
    if (!data.templates) {
      return res.status(404).json({ success: false, error: '模板不存在' });
    }

    const templateIndex = data.templates.findIndex(t => t.id === id);
    if (templateIndex === -1) {
      return res.status(404).json({ success: false, error: '模板不存在' });
    }

    // 更新模板
    data.templates[templateIndex] = {
      ...data.templates[templateIndex],
      name: name || data.templates[templateIndex].name,
      description: description !== undefined ? description : data.templates[templateIndex].description,
      config: config || data.templates[templateIndex].config,
      updatedAt: new Date().toISOString()
    };

    await writeData(data);

    res.json({ success: true, template: data.templates[templateIndex] });
  } catch (error) {
    console.error('更新模板失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除模板
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const data = await readData();
    if (!data.templates) {
      return res.status(404).json({ success: false, error: '模板不存在' });
    }

    const templateIndex = data.templates.findIndex(t => t.id === id);
    if (templateIndex === -1) {
      return res.status(404).json({ success: false, error: '模板不存在' });
    }

    data.templates.splice(templateIndex, 1);
    await writeData(data);

    res.json({ success: true });
  } catch (error) {
    console.error('删除模板失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单个模板
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const data = await readData();
    const template = (data.templates || []).find(t => t.id === id);

    if (!template) {
      return res.status(404).json({ success: false, error: '模板不存在' });
    }

    res.json({ success: true, template });
  } catch (error) {
    console.error('获取模板失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
