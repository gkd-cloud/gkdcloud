/**
 * 订阅内容修改器
 * 用于解析和替换 Base64 编码订阅中的节点连接域名
 */

class SubscriptionModifier {
  /**
   * @param {Object} domainMapping - 域名映射表 { "old.com": "new.com" }
   */
  constructor(domainMapping) {
    this.domainMapping = domainMapping || {};
  }

  /**
   * 修改 Base64 编码的订阅内容
   * @param {string} base64Content - Base64 编码的订阅原文
   * @returns {string} 修改后的 Base64 编码内容
   */
  modify(base64Content) {
    const decoded = Buffer.from(base64Content, 'base64').toString('utf-8');
    const lines = decoded.split('\n');
    const modifiedLines = lines.map(line => this._modifyLine(line.trim()));
    return Buffer.from(modifiedLines.join('\n')).toString('base64');
  }

  /**
   * 修改单行代理 URI
   */
  _modifyLine(line) {
    if (!line) return line;

    if (line.startsWith('vmess://')) return this._modifyVmess(line);
    if (line.startsWith('ss://')) return this._modifySS(line);
    if (line.startsWith('trojan://')) return this._modifyTrojan(line);
    if (line.startsWith('vless://')) return this._modifyVless(line);
    if (line.startsWith('hysteria2://') || line.startsWith('hy2://')) return this._modifyHysteria2(line);

    return line;
  }

  /**
   * 替换域名
   */
  _replaceDomain(domain) {
    return this.domainMapping[domain] || domain;
  }

  /**
   * vmess://base64(JSON)
   * JSON 中 "add" 字段为服务器地址
   */
  _modifyVmess(line) {
    try {
      const encoded = line.substring('vmess://'.length);
      const json = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
      if (json.add) {
        json.add = this._replaceDomain(json.add);
      }
      return 'vmess://' + Buffer.from(JSON.stringify(json)).toString('base64');
    } catch {
      return line;
    }
  }

  /**
   * ss://base64(method:password)@server:port#name
   * 或 ss://base64(method:password@server:port)#name (SIP002)
   */
  _modifySS(line) {
    try {
      const withoutScheme = line.substring('ss://'.length);

      // 提取 fragment (#节点名称)
      const hashIdx = withoutScheme.lastIndexOf('#');
      const fragment = hashIdx !== -1 ? withoutScheme.substring(hashIdx) : '';
      const main = hashIdx !== -1 ? withoutScheme.substring(0, hashIdx) : withoutScheme;

      const atIdx = main.indexOf('@');
      if (atIdx !== -1) {
        // 格式: base64部分@server:port 或 method:password@server:port
        const userInfo = main.substring(0, atIdx);
        const serverPart = main.substring(atIdx + 1);
        const colonIdx = serverPart.lastIndexOf(':');
        if (colonIdx !== -1) {
          const server = serverPart.substring(0, colonIdx);
          const port = serverPart.substring(colonIdx);
          return 'ss://' + userInfo + '@' + this._replaceDomain(server) + port + fragment;
        }
      } else {
        // 整体 base64 编码: ss://base64(method:password@server:port)
        const decoded = Buffer.from(main, 'base64').toString('utf-8');
        const decodedAtIdx = decoded.lastIndexOf('@');
        if (decodedAtIdx !== -1) {
          const credentials = decoded.substring(0, decodedAtIdx);
          const serverPart = decoded.substring(decodedAtIdx + 1);
          const colonIdx = serverPart.lastIndexOf(':');
          if (colonIdx !== -1) {
            const server = serverPart.substring(0, colonIdx);
            const port = serverPart.substring(colonIdx);
            const modified = credentials + '@' + this._replaceDomain(server) + port;
            return 'ss://' + Buffer.from(modified).toString('base64') + fragment;
          }
        }
      }
      return line;
    } catch {
      return line;
    }
  }

  /**
   * trojan://password@server:port?params#name
   */
  _modifyTrojan(line) {
    return this._modifyStandardUri(line, 'trojan://');
  }

  /**
   * vless://uuid@server:port?params#name
   */
  _modifyVless(line) {
    return this._modifyStandardUri(line, 'vless://');
  }

  /**
   * hysteria2://auth@server:port?params#name
   */
  _modifyHysteria2(line) {
    const scheme = line.startsWith('hysteria2://') ? 'hysteria2://' : 'hy2://';
    return this._modifyStandardUri(line, scheme);
  }

  /**
   * 通用格式: scheme://userinfo@server:port?query#fragment
   */
  _modifyStandardUri(line, scheme) {
    try {
      const withoutScheme = line.substring(scheme.length);

      // 提取 fragment
      const hashIdx = withoutScheme.indexOf('#');
      const fragment = hashIdx !== -1 ? withoutScheme.substring(hashIdx) : '';
      const beforeHash = hashIdx !== -1 ? withoutScheme.substring(0, hashIdx) : withoutScheme;

      // 提取 query
      const queryIdx = beforeHash.indexOf('?');
      const query = queryIdx !== -1 ? beforeHash.substring(queryIdx) : '';
      const beforeQuery = queryIdx !== -1 ? beforeHash.substring(0, queryIdx) : beforeHash;

      // 分离 userinfo 和 server:port
      const atIdx = beforeQuery.indexOf('@');
      if (atIdx === -1) return line;

      const userInfo = beforeQuery.substring(0, atIdx);
      const serverPart = beforeQuery.substring(atIdx + 1);

      // 处理 IPv6 地址 [::1]:port
      let server, port;
      if (serverPart.startsWith('[')) {
        const bracketEnd = serverPart.indexOf(']');
        server = serverPart.substring(0, bracketEnd + 1);
        port = serverPart.substring(bracketEnd + 1);
      } else {
        const colonIdx = serverPart.lastIndexOf(':');
        server = colonIdx !== -1 ? serverPart.substring(0, colonIdx) : serverPart;
        port = colonIdx !== -1 ? serverPart.substring(colonIdx) : '';
      }

      return scheme + userInfo + '@' + this._replaceDomain(server) + port + query + fragment;
    } catch {
      return line;
    }
  }
}

module.exports = SubscriptionModifier;
