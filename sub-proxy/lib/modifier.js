/**
 * 订阅内容修改器
 * 解析 Base64 编码的订阅，按协议替换节点连接域名
 */

function replaceDomain(domain, mapping) {
  return mapping[domain] || domain;
}

// vmess://base64(JSON)  →  JSON.add 为服务器地址
function modifyVmess(line, mapping) {
  try {
    const json = JSON.parse(Buffer.from(line.slice(8), 'base64').toString('utf-8'));
    if (json.add) json.add = replaceDomain(json.add, mapping);
    return 'vmess://' + Buffer.from(JSON.stringify(json)).toString('base64');
  } catch { return line; }
}

// scheme://userinfo@server:port?query#fragment  (trojan / vless / hysteria2)
function modifyStandardUri(line, scheme, mapping) {
  try {
    const rest = line.slice(scheme.length);
    const hashIdx = rest.indexOf('#');
    const fragment = hashIdx !== -1 ? rest.slice(hashIdx) : '';
    const beforeHash = hashIdx !== -1 ? rest.slice(0, hashIdx) : rest;

    const qIdx = beforeHash.indexOf('?');
    const query = qIdx !== -1 ? beforeHash.slice(qIdx) : '';
    const beforeQuery = qIdx !== -1 ? beforeHash.slice(0, qIdx) : beforeHash;

    const atIdx = beforeQuery.indexOf('@');
    if (atIdx === -1) return line;

    const userInfo = beforeQuery.slice(0, atIdx);
    const serverPart = beforeQuery.slice(atIdx + 1);

    let server, port;
    if (serverPart.startsWith('[')) {
      const bEnd = serverPart.indexOf(']');
      server = serverPart.slice(0, bEnd + 1);
      port = serverPart.slice(bEnd + 1);
    } else {
      const cIdx = serverPart.lastIndexOf(':');
      server = cIdx !== -1 ? serverPart.slice(0, cIdx) : serverPart;
      port = cIdx !== -1 ? serverPart.slice(cIdx) : '';
    }

    return scheme + userInfo + '@' + replaceDomain(server, mapping) + port + query + fragment;
  } catch { return line; }
}

// ss://base64@server:port#name  或  ss://base64(全部)#name
function modifySS(line, mapping) {
  try {
    const rest = line.slice(5);
    const hashIdx = rest.lastIndexOf('#');
    const fragment = hashIdx !== -1 ? rest.slice(hashIdx) : '';
    const main = hashIdx !== -1 ? rest.slice(0, hashIdx) : rest;

    const atIdx = main.indexOf('@');
    if (atIdx !== -1) {
      const userInfo = main.slice(0, atIdx);
      const serverPart = main.slice(atIdx + 1);
      const cIdx = serverPart.lastIndexOf(':');
      if (cIdx !== -1) {
        const server = serverPart.slice(0, cIdx);
        const port = serverPart.slice(cIdx);
        return 'ss://' + userInfo + '@' + replaceDomain(server, mapping) + port + fragment;
      }
    } else {
      const decoded = Buffer.from(main, 'base64').toString('utf-8');
      const dAtIdx = decoded.lastIndexOf('@');
      if (dAtIdx !== -1) {
        const cred = decoded.slice(0, dAtIdx);
        const sp = decoded.slice(dAtIdx + 1);
        const cIdx = sp.lastIndexOf(':');
        if (cIdx !== -1) {
          const modified = cred + '@' + replaceDomain(sp.slice(0, cIdx), mapping) + sp.slice(cIdx);
          return 'ss://' + Buffer.from(modified).toString('base64') + fragment;
        }
      }
    }
    return line;
  } catch { return line; }
}

function modifyLine(line, mapping) {
  if (!line) return line;
  if (line.startsWith('vmess://')) return modifyVmess(line, mapping);
  if (line.startsWith('ss://')) return modifySS(line, mapping);
  if (line.startsWith('trojan://')) return modifyStandardUri(line, 'trojan://', mapping);
  if (line.startsWith('vless://')) return modifyStandardUri(line, 'vless://', mapping);
  if (line.startsWith('hysteria2://')) return modifyStandardUri(line, 'hysteria2://', mapping);
  if (line.startsWith('hy2://')) return modifyStandardUri(line, 'hy2://', mapping);
  return line;
}

/**
 * @param {string} base64Content - Base64 编码的订阅原文
 * @param {Object} domainMapping - { "旧域名": "新域名" }
 * @returns {string} 替换后的 Base64 内容
 */
function modifySubscription(base64Content, domainMapping) {
  const decoded = Buffer.from(base64Content, 'base64').toString('utf-8');
  const lines = decoded.split('\n').map(l => modifyLine(l.trim(), domainMapping));
  return Buffer.from(lines.join('\n')).toString('base64');
}

module.exports = { modifySubscription };
