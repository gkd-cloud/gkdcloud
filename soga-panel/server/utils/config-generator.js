class ConfigGenerator {
  // 生成 soga.conf
  generateSogaConf(config) {
    const {
      // 基础配置
      panelType = 'sspanel-uim',
      serverType = 'v2ray',
      nodeId,
      sogaKey = '',
      api = 'webapi',
      // WebAPI 对接配置
      panelUrl,
      panelKey,
      // 数据库对接配置（可选）
      dbHost = '',
      dbPort = 3306,
      dbName = '',
      dbUser = 'root',
      dbPassword = '',
      dbMaxIdleTime = 480,
      dbMaxIdleConn = 4,
      dbMaxConn = 4,
      // DNS 配置
      defaultDns = '',
      dnsCacheTime = 10,
      dnsStrategy = 'ipv4_first',
      dnsType = 'tcp',
      enableDNS = false,
      dnsListenPort = 53,
      // 证书配置
      certFile,
      keyFile,
      certDomain,
      // 日志配置
      logLevel = 'info',
      logFile = '',
      // 其他配置
      enableProxyProtocol = false,
      checkInterval = 60,
      userConnLimit = 0,
      userSpeedLimit = 0,
      localRuleList = '',
      forwardRuleList = '',
      blockRuleList = ''
    } = config;

    let conf = `# Soga 配置文件
# 基础配置（必填）
type=${panelType}
server_type=${serverType}
node_id=${nodeId}
`;

    // 授权码（可选）
    if (sogaKey) {
      conf += `soga_key=${sogaKey}\n`;
    }

    conf += `api=${api}

# 对接配置
`;

    // WebAPI 对接
    if (api === 'webapi') {
      conf += `webapi_url=${panelUrl}
webapi_key=${panelKey}
`;
    }

    // 数据库对接
    if (api === 'db' || dbHost) {
      conf += `db_host=${dbHost}
db_port=${dbPort}
db_name=${dbName}
db_user=${dbUser}
db_password=${dbPassword}
db_max_idle_time=${dbMaxIdleTime}
db_max_idle_conn=${dbMaxIdleConn}
db_max_conn=${dbMaxConn}
`;
    }

    // DNS 配置
    conf += `
# DNS 配置
`;
    if (defaultDns) {
      conf += `default_dns=${defaultDns}
`;
    }
    conf += `dns_cache_time=${dnsCacheTime}
dns_strategy=${dnsStrategy}
dns_type=${dnsType}
enable_dns=${enableDNS}
dns_listen_port=${dnsListenPort}

# 证书配置
`;

    if (certFile) {
      conf += `cert_file=/etc/soga/cert.pem\n`;
    }
    if (keyFile) {
      conf += `key_file=/etc/soga/key.pem\n`;
    }
    if (certDomain) {
      conf += `cert_domain=${certDomain}\n`;
    }

    conf += `
# 日志配置
log_level=${logLevel}
`;

    if (logFile) {
      conf += `log_file=${logFile}\n`;
    }

    conf += `
# DNS 配置
dns_type=${dnsType}
enable_dns=${enableDNS}
dns_listen_port=${dnsListenPort}

# 其他配置
check_interval=${checkInterval}
user_conn_limit=${userConnLimit}
user_speed_limit=${userSpeedLimit}
enable_proxy_protocol=${enableProxyProtocol}

# 规则列表
`;

    if (localRuleList) {
      conf += `local_rule_list=${localRuleList}\n`;
    }
    if (forwardRuleList) {
      conf += `forward_rule_list=${forwardRuleList}\n`;
    }
    if (blockRuleList) {
      conf += `block_rule_list=${blockRuleList}\n`;
    }

    return conf;
  }

  // 生成 route.toml
  generateRouteToml(routeConfig) {
    let toml = `# Soga 路由配置
# 此文件用于配置流量路由规则

`;

    // 直连规则
    if (routeConfig.direct && routeConfig.direct.length > 0) {
      toml += `[[direct]]\n`;
      routeConfig.direct.forEach(rule => {
        if (rule.type === 'domain') {
          toml += `domain = "${rule.value}"\n`;
        } else if (rule.type === 'ip') {
          toml += `ip = "${rule.value}"\n`;
        } else if (rule.type === 'cidr') {
          toml += `cidr = "${rule.value}"\n`;
        }
      });
      toml += `\n`;
    }

    // 代理规则
    if (routeConfig.proxy && routeConfig.proxy.length > 0) {
      toml += `[[proxy]]\n`;
      routeConfig.proxy.forEach(rule => {
        if (rule.type === 'domain') {
          toml += `domain = "${rule.value}"\n`;
        } else if (rule.type === 'ip') {
          toml += `ip = "${rule.value}"\n`;
        } else if (rule.type === 'cidr') {
          toml += `cidr = "${rule.value}"\n`;
        }
      });
      toml += `\n`;
    }

    // 阻断规则
    if (routeConfig.block && routeConfig.block.length > 0) {
      toml += `[[block]]\n`;
      routeConfig.block.forEach(rule => {
        if (rule.type === 'domain') {
          toml += `domain = "${rule.value}"\n`;
        } else if (rule.type === 'ip') {
          toml += `ip = "${rule.value}"\n`;
        } else if (rule.type === 'cidr') {
          toml += `cidr = "${rule.value}"\n`;
        }
      });
      toml += `\n`;
    }

    return toml;
  }

  // 生成 blocklist
  generateBlockList(blockList) {
    let list = `# Soga 黑名单配置
# 每行一个规则，支持域名、IP、CIDR、正则表达式

`;

    if (Array.isArray(blockList)) {
      blockList.forEach(item => {
        list += `${item}\n`;
      });
    } else if (typeof blockList === 'string') {
      list += blockList;
    }

    return list;
  }

  // 验证配置
  validateConfig(config) {
    const errors = [];

    if (!config.panelUrl) {
      errors.push('面板地址不能为空');
    }

    if (!config.panelKey) {
      errors.push('面板密钥不能为空');
    }

    if (!config.nodeId) {
      errors.push('节点 ID 不能为空');
    }

    // 验证 URL 格式
    if (config.panelUrl) {
      try {
        new URL(config.panelUrl);
      } catch {
        errors.push('面板地址格式不正确');
      }
    }

    // 验证节点 ID
    if (config.nodeId && isNaN(parseInt(config.nodeId))) {
      errors.push('节点 ID 必须是数字');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = ConfigGenerator;
