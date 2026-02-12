const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs').promises;
const SubscriptionModifier = require('../utils/subscription-modifier');

const CONFIG_PATH = path.join(__dirname, '../../data/subscribe-config.json');

/**
 * 读取订阅代理配置
 */
async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * 请求上游订阅内容
 */
function fetchUpstream(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      // 跟随重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUpstream(res.headers.location).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`上游返回 ${res.statusCode}`));
      }

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          body: Buffer.concat(chunks).toString('utf-8'),
          headers: res.headers
        });
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * 判断 UA 是否为 Shadowrocket
 */
function isShadowrocket(ua) {
  return /shadowrocket/i.test(ua || '');
}

/**
 * GET /sub/:token
 * 订阅代理端点 - 无需面板认证，客户端直接访问
 */
router.get('/:token', async (req, res) => {
  try {
    const config = await loadConfig();
    if (!config || !config.enabled) {
      return res.status(503).json({ error: '订阅代理未启用' });
    }

    const { token } = req.params;
    const queryString = new URLSearchParams(req.query).toString();
    const upstreamUrl = `${config.upstreamBaseUrl}/${token}${queryString ? '?' + queryString : ''}`;

    // 请求上游
    const upstream = await fetchUpstream(upstreamUrl);

    // 透传上游响应头
    const passthroughHeaders = [
      'subscription-userinfo',
      'content-disposition',
      'profile-update-interval',
      'profile-title'
    ];
    for (const header of passthroughHeaders) {
      if (upstream.headers[header]) {
        res.set(header, upstream.headers[header]);
      }
    }
    res.set('Content-Type', upstream.headers['content-type'] || 'text/plain; charset=utf-8');

    // UA 检测：Shadowrocket 则替换域名，否则原样返回
    const ua = req.headers['user-agent'];
    if (isShadowrocket(ua) && config.domainMapping && Object.keys(config.domainMapping).length > 0) {
      const modifier = new SubscriptionModifier(config.domainMapping);
      const modified = modifier.modify(upstream.body);
      return res.send(modified);
    }

    return res.send(upstream.body);
  } catch (err) {
    console.error('订阅代理错误:', err.message);
    return res.status(502).json({ error: '获取上游订阅失败', message: err.message });
  }
});

module.exports = router;
