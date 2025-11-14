const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data/servers.json');

// 读取数据
const readData = async () => {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取数据失败:', error);
    return { servers: [], instances: [], routeConfigs: [] };
  }
};

// 写入数据
const writeData = async (data) => {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
};

// 获取所有路由配置
router.get('/', async (req, res) => {
  try {
    const data = await readData();
    const routeConfigs = data.routeConfigs || [];
    res.json({ success: true, configs: routeConfigs });
  } catch (error) {
    console.error('获取路由配置失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取单个路由配置
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await readData();
    const routeConfigs = data.routeConfigs || [];

    const config = routeConfigs.find(c => c.id === id);
    if (!config) {
      return res.status(404).json({ error: '路由配置不存在' });
    }

    res.json({ success: true, config });
  } catch (error) {
    console.error('获取路由配置失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 创建路由配置
router.post('/', async (req, res) => {
  try {
    const { name, routeConfig, blockList, description, isDefault } = req.body;

    if (!name || !routeConfig) {
      return res.status(400).json({ error: '缺少必要参数：name 和 routeConfig' });
    }

    const data = await readData();
    if (!data.routeConfigs) {
      data.routeConfigs = [];
    }

    // 检查名称是否已存在
    if (data.routeConfigs.some(c => c.name === name)) {
      return res.status(400).json({ error: '该名称的路由配置已存在' });
    }

    // 如果设为默认，取消其他配置的默认状态
    if (isDefault) {
      data.routeConfigs.forEach(c => {
        c.isDefault = false;
      });
    }

    // 创建新配置
    const newConfig = {
      id: Date.now().toString(),
      name,
      routeConfig,
      blockList: blockList || '',
      description: description || '',
      isDefault: isDefault || false,
      createdAt: new Date().toISOString()
    };

    data.routeConfigs.push(newConfig);
    await writeData(data);

    res.json({ success: true, config: newConfig });
  } catch (error) {
    console.error('创建路由配置失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 更新路由配置
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, routeConfig, blockList, description, isDefault } = req.body;

    const data = await readData();
    if (!data.routeConfigs) {
      data.routeConfigs = [];
    }

    const index = data.routeConfigs.findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ error: '路由配置不存在' });
    }

    // 如果更改了名称，检查新名称是否已存在
    if (name && name !== data.routeConfigs[index].name) {
      if (data.routeConfigs.some(c => c.name === name && c.id !== id)) {
        return res.status(400).json({ error: '该名称的路由配置已存在' });
      }
    }

    // 如果设为默认，取消其他配置的默认状态
    if (isDefault) {
      data.routeConfigs.forEach(c => {
        if (c.id !== id) {
          c.isDefault = false;
        }
      });
    }

    // 更新配置
    const updatedConfig = {
      ...data.routeConfigs[index],
      name: name || data.routeConfigs[index].name,
      routeConfig: routeConfig !== undefined ? routeConfig : data.routeConfigs[index].routeConfig,
      blockList: blockList !== undefined ? blockList : data.routeConfigs[index].blockList,
      description: description !== undefined ? description : data.routeConfigs[index].description,
      isDefault: isDefault !== undefined ? isDefault : data.routeConfigs[index].isDefault,
      updatedAt: new Date().toISOString()
    };

    data.routeConfigs[index] = updatedConfig;
    await writeData(data);

    res.json({ success: true, config: updatedConfig });
  } catch (error) {
    console.error('更新路由配置失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 设置默认路由配置
router.put('/:id/set-default', async (req, res) => {
  try {
    const { id } = req.params;

    const data = await readData();
    if (!data.routeConfigs) {
      data.routeConfigs = [];
    }

    const config = data.routeConfigs.find(c => c.id === id);
    if (!config) {
      return res.status(404).json({ error: '路由配置不存在' });
    }

    // 取消所有配置的默认状态
    data.routeConfigs.forEach(c => {
      c.isDefault = false;
    });

    // 设置新的默认配置
    config.isDefault = true;
    await writeData(data);

    res.json({ success: true, config });
  } catch (error) {
    console.error('设置默认配置失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 删除路由配置
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const data = await readData();
    if (!data.routeConfigs) {
      data.routeConfigs = [];
    }

    const index = data.routeConfigs.findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ error: '路由配置不存在' });
    }

    // 删除配置
    data.routeConfigs.splice(index, 1);
    await writeData(data);

    res.json({ success: true, message: '路由配置删除成功' });
  } catch (error) {
    console.error('删除路由配置失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取默认路由配置
router.get('/default/config', async (req, res) => {
  try {
    const data = await readData();
    const routeConfigs = data.routeConfigs || [];

    const defaultConfig = routeConfigs.find(c => c.isDefault);
    if (!defaultConfig) {
      return res.json({ success: true, config: null });
    }

    res.json({ success: true, config: defaultConfig });
  } catch (error) {
    console.error('获取默认路由配置失败:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
