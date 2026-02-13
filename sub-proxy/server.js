const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { modifySubscription } = require('./lib/modifier');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
const app = express();

/**
 * 请求上游订阅
 */
function fetchUpstream(url, ua) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': ua || 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUpstream(res.headers.location, ua).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`upstream ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf-8'), headers: res.headers }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * GET /:token
 * 用户原订阅路径不变，只需把域名指向本服务即可
 */
app.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const qs = new URLSearchParams(req.query).toString();
    const upstreamUrl = `${config.upstream}/${token}${qs ? '?' + qs : ''}`;
    const ua = req.headers['user-agent'] || '';

    const upstream = await fetchUpstream(upstreamUrl, ua);

    // 透传上游响应头
    ['subscription-userinfo', 'content-disposition', 'profile-update-interval', 'profile-title']
      .forEach(h => { if (upstream.headers[h]) res.set(h, upstream.headers[h]); });
    res.set('Content-Type', upstream.headers['content-type'] || 'text/plain; charset=utf-8');

    // Shadowrocket UA → 替换域名
    if (/shadowrocket/i.test(ua) && config.domainMapping && Object.keys(config.domainMapping).length > 0) {
      return res.send(modifySubscription(upstream.body, config.domainMapping));
    }

    res.send(upstream.body);
  } catch (err) {
    console.error('[sub-proxy]', err.message);
    res.status(502).send('upstream error');
  }
});

app.listen(config.port, () => {
  console.log(`sub-proxy listening on :${config.port}`);
});
