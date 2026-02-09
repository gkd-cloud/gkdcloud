/// DoH 配置数据模型

/// DoH 服务器配置
class DoHServerConfig {
  final String url;
  final String name;
  final int weight;
  final String? ip; // 直连 IP（跳过 DNS 解析）

  DoHServerConfig({
    required this.url,
    required this.name,
    this.weight = 10,
    this.ip,
  });

  factory DoHServerConfig.fromJson(Map<String, dynamic> json) {
    return DoHServerConfig(
      url: json['url'] as String,
      name: json['name'] as String,
      weight: json['weight'] as int? ?? 10,
      ip: json['ip'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'url': url,
        'name': name,
        'weight': weight,
        if (ip != null) 'ip': ip,
      };

  DoHServerConfig copyWith({
    String? url,
    String? name,
    int? weight,
    String? ip,
  }) {
    return DoHServerConfig(
      url: url ?? this.url,
      name: name ?? this.name,
      weight: weight ?? this.weight,
      ip: ip ?? this.ip,
    );
  }
}

/// DoH 选择策略
enum DoHStrategy {
  fastest('最快响应'),
  random('随机选择'),
  roundRobin('轮询');

  final String displayName;
  const DoHStrategy(this.displayName);
}

/// 完整 DoH 配置
class DoHConfig {
  final List<DoHServerConfig> servers;
  final List<DoHServerConfig> fallbackServers;
  final DoHStrategy strategy;
  final int cacheTTL;
  final int cacheSize;
  final List<String> bootstrap;
  final bool enableIPv6;
  final Map<String, String> hostMapping;

  DoHConfig({
    required this.servers,
    this.fallbackServers = const [],
    this.strategy = DoHStrategy.fastest,
    this.cacheTTL = 300,
    this.cacheSize = 1000,
    this.bootstrap = const ['1.1.1.1', '8.8.8.8'],
    this.enableIPv6 = false,
    this.hostMapping = const {},
  });

  /// 默认配置
  factory DoHConfig.defaultConfig() {
    return DoHConfig(
      servers: [
        DoHServerConfig(
          url: 'https://1.1.1.1/dns-query',
          name: 'Cloudflare',
          weight: 10,
        ),
        DoHServerConfig(
          url: 'https://8.8.8.8/dns-query',
          name: 'Google',
          weight: 8,
        ),
      ],
      fallbackServers: [
        DoHServerConfig(
          url: 'https://9.9.9.9/dns-query',
          name: 'Quad9',
          weight: 5,
        ),
        DoHServerConfig(
          url: 'https://223.5.5.5/dns-query',
          name: 'AliDNS',
          weight: 5,
        ),
      ],
      strategy: DoHStrategy.fastest,
      cacheTTL: 300,
      cacheSize: 1000,
      bootstrap: ['1.1.1.1', '8.8.8.8'],
    );
  }

  factory DoHConfig.fromJson(Map<String, dynamic> json) {
    return DoHConfig(
      servers: (json['servers'] as List<dynamic>?)
              ?.map((e) =>
                  DoHServerConfig.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      fallbackServers: (json['fallback_servers'] as List<dynamic>?)
              ?.map((e) =>
                  DoHServerConfig.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      strategy: DoHStrategy.values.firstWhere(
        (e) => e.name == json['strategy'],
        orElse: () => DoHStrategy.fastest,
      ),
      cacheTTL: json['cache_ttl'] as int? ?? 300,
      cacheSize: json['cache_size'] as int? ?? 1000,
      bootstrap: (json['bootstrap'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          ['1.1.1.1', '8.8.8.8'],
      enableIPv6: json['enable_ipv6'] as bool? ?? false,
      hostMapping:
          (json['host_mapping'] as Map<String, dynamic>?)?.map(
                (k, v) => MapEntry(k, v as String),
              ) ??
              {},
    );
  }

  Map<String, dynamic> toJson() => {
        'servers': servers.map((e) => e.toJson()).toList(),
        'fallback_servers': fallbackServers.map((e) => e.toJson()).toList(),
        'strategy': strategy.name,
        'cache_ttl': cacheTTL,
        'cache_size': cacheSize,
        'bootstrap': bootstrap,
        'enable_ipv6': enableIPv6,
        'host_mapping': hostMapping,
      };

  /// 生成 clash-meta DNS 配置段
  Map<String, dynamic> toClashDNSConfig() {
    final config = <String, dynamic>{
      'enable': true,
      'listen': '0.0.0.0:53',
      'enhanced-mode': 'fake-ip',
      'fake-ip-range': '198.18.0.1/16',
      'use-hosts': true,
      'default-nameserver': bootstrap,
      'nameserver': servers.map((s) => s.url).toList(),
    };

    if (fallbackServers.isNotEmpty) {
      config['fallback'] = fallbackServers.map((s) => s.url).toList();
      config['fallback-filter'] = {
        'geoip': true,
        'geoip-code': 'CN',
        'ipcidr': ['240.0.0.0/4'],
      };
    }

    if (hostMapping.isNotEmpty) {
      config['hosts'] = hostMapping;
    }

    return config;
  }

  DoHConfig copyWith({
    List<DoHServerConfig>? servers,
    List<DoHServerConfig>? fallbackServers,
    DoHStrategy? strategy,
    int? cacheTTL,
    int? cacheSize,
    List<String>? bootstrap,
    bool? enableIPv6,
    Map<String, String>? hostMapping,
  }) {
    return DoHConfig(
      servers: servers ?? this.servers,
      fallbackServers: fallbackServers ?? this.fallbackServers,
      strategy: strategy ?? this.strategy,
      cacheTTL: cacheTTL ?? this.cacheTTL,
      cacheSize: cacheSize ?? this.cacheSize,
      bootstrap: bootstrap ?? this.bootstrap,
      enableIPv6: enableIPv6 ?? this.enableIPv6,
      hostMapping: hostMapping ?? this.hostMapping,
    );
  }
}

/// DoH 测速结果
class DoHSpeedTestResult {
  final String serverUrl;
  final String serverName;
  final Duration latency;
  final bool available;
  final String? error;

  DoHSpeedTestResult({
    required this.serverUrl,
    required this.serverName,
    required this.latency,
    required this.available,
    this.error,
  });

  String get formattedLatency {
    if (!available) return '不可用';
    return '${latency.inMilliseconds}ms';
  }
}
