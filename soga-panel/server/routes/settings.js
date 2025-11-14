const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const settingsFile = path.join(__dirname, '../data/settings.json');

// 确保设置文件存在
async function ensureSettingsFile() {
    try {
        await fs.access(settingsFile);
    } catch {
        const defaultSettings = {
            https: {
                enabled: false,
                port: 443,
                certType: 'none', // 'none', 'manual', 'letsencrypt'
                certPath: '',
                keyPath: '',
                domain: ''
            }
        };
        await fs.writeFile(settingsFile, JSON.stringify(defaultSettings, null, 2));
    }
}

// 读取设置
async function readSettings() {
    await ensureSettingsFile();
    const data = await fs.readFile(settingsFile, 'utf8');
    return JSON.parse(data);
}

// 写入设置
async function writeSettings(settings) {
    await fs.writeFile(settingsFile, JSON.stringify(settings, null, 2));
}

// 获取设置
router.get('/', async (req, res) => {
    try {
        const settings = await readSettings();
        res.json({ success: true, settings });
    } catch (error) {
        console.error('读取设置失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 更新设置
router.put('/', async (req, res) => {
    try {
        const { settings } = req.body;
        await writeSettings(settings);
        res.json({ success: true, message: '设置已保存' });
    } catch (error) {
        console.error('保存设置失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 上传证书文件
router.post('/upload-cert', async (req, res) => {
    try {
        const { certContent, keyContent } = req.body;

        if (!certContent || !keyContent) {
            return res.status(400).json({ success: false, error: '请提供证书和私钥内容' });
        }

        const certsDir = path.join(__dirname, '../data/certs');
        await fs.mkdir(certsDir, { recursive: true });

        const certPath = path.join(certsDir, 'certificate.crt');
        const keyPath = path.join(certsDir, 'private.key');

        await fs.writeFile(certPath, certContent);
        await fs.writeFile(keyPath, keyContent);

        // 更新设置
        const settings = await readSettings();
        settings.https.certPath = certPath;
        settings.https.keyPath = keyPath;
        settings.https.certType = 'manual';
        await writeSettings(settings);

        res.json({
            success: true,
            message: '证书上传成功',
            certPath,
            keyPath
        });
    } catch (error) {
        console.error('上传证书失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 测试 HTTPS 配置
router.post('/test-https', async (req, res) => {
    try {
        const settings = await readSettings();

        if (!settings.https.enabled) {
            return res.json({ success: false, error: 'HTTPS 未启用' });
        }

        if (settings.https.certType === 'manual') {
            // 检查证书文件是否存在
            try {
                await fs.access(settings.https.certPath);
                await fs.access(settings.https.keyPath);
                res.json({ success: true, message: 'HTTPS 配置有效' });
            } catch {
                res.json({ success: false, error: '证书文件不存在或无法访问' });
            }
        } else {
            res.json({ success: false, error: '暂不支持此证书类型' });
        }
    } catch (error) {
        console.error('测试 HTTPS 配置失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
