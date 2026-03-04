import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../models/subscription_config.dart';
import '../models/doh_config.dart';
import '../models/mask_rule.dart';

/// 订阅服务 - 负责获取、解析、转换订阅
class SubscriptionService {
  final http.Client _client;
  final DomainMaskService _maskService;
  final DoHService _dohService;

  SubscriptionService({
    http.Client? client,
    required DomainMaskService maskService,
    required DoHService dohService,
  })  : _client = client ?? http.Client(),
        _maskService = maskService,
        _dohService = dohService;

  /// 获取并处理订阅
  /// 返回处理后的 Clash 配置 YAML 字符串
  Future<SubscriptionResult> fetchSubscription(
      SubscriptionConfig config) async {
    // 1. 获取原始订阅内容
    final rawContent = await _fetchRawSubscription(config.url);

    // 2. 解析节点列表
    final nodes = _parseNodes(rawContent, config.panelType);

    // 3. 应用域名伪装
    final maskedNodes = _maskService.applyMasking(nodes);

    // 4. 注入 DoH 配置
    final dnsConfig = _dohService.generateDNSConfig();

    // 5. 解析流量和过期信息
    final trafficInfo = _lastTrafficInfo;
    final expireAt = _lastExpireAt;

    return SubscriptionResult(
      nodes: maskedNodes,
      dnsConfig: dnsConfig,
      trafficInfo: trafficInfo,
      expireAt: expireAt,
    );
  }

  TrafficInfo? _lastTrafficInfo;
  int? _lastExpireAt;

  /// 获取原始订阅内容
  Future<String> _fetchRawSubscription(String url) async {
    final response = await _client.get(
      Uri.parse(url),
      headers: {
        'User-Agent': 'ClashForAndroid/2.5.12',
      },
    );

    if (response.statusCode != 200) {
      throw SubscriptionException(
        '获取订阅失败: HTTP ${response.statusCode}',
      );
    }

    // 从 Header 解析流量信息
    final userInfo = response.headers['subscription-userinfo'];
    if (userInfo != null) {
      _lastTrafficInfo = _parseTrafficInfo(userInfo);
      _lastExpireAt = _parseExpireAt(userInfo);
    }

    return response.body;
  }

  /// 解析节点列表
  List<Map<String, dynamic>> _parseNodes(
      String content, PanelType panelType) {
    // 尝试 Base64 解码
    String decoded;
    try {
      decoded = utf8.decode(base64Decode(_padBase64(content.trim())));
    } catch (_) {
      decoded = content;
    }

    // 检查是否是 Clash YAML
    if (decoded.trimLeft().startsWith('proxies:') ||
        decoded.contains('\nproxies:')) {
      return _parseClashYaml(decoded);
    }

    // 检查是否是 JSON (V2Board)
    if (decoded.trimLeft().startsWith('[') ||
        decoded.trimLeft().startsWith('{')) {
      try {
        return _parseV2BoardJSON(decoded);
      } catch (_) {
        // 不是有效 JSON，继续其他解析
      }
    }

    // Base64 编码的链接列表
    return _parseNodeLinks(decoded);
  }

  /// 解析 Base64 编码的代理链接列表
  List<Map<String, dynamic>> _parseNodeLinks(String content) {
    final lines = content.split('\n').where((l) => l.trim().isNotEmpty);
    final nodes = <Map<String, dynamic>>[];

    for (final line in lines) {
      final trimmed = line.trim();
      try {
        final node = _parseLink(trimmed);
        if (node != null) {
          nodes.add(node);
        }
      } catch (_) {
        // 跳过解析失败的行
        continue;
      }
    }

    return nodes;
  }

  /// 解析单个代理链接
  Map<String, dynamic>? _parseLink(String link) {
    if (link.startsWith('vmess://')) {
      return _parseVmessLink(link);
    } else if (link.startsWith('vless://')) {
      return _parseVlessLink(link);
    } else if (link.startsWith('trojan://')) {
      return _parseTrojanLink(link);
    } else if (link.startsWith('ss://')) {
      return _parseSSLink(link);
    } else if (link.startsWith('hysteria2://') ||
        link.startsWith('hy2://')) {
      return _parseHysteria2Link(link);
    }
    return null;
  }

  Map<String, dynamic> _parseVmessLink(String link) {
    final raw = link.substring('vmess://'.length);
    final decoded = utf8.decode(base64Decode(_padBase64(raw)));
    final json = jsonDecode(decoded) as Map<String, dynamic>;

    final node = <String, dynamic>{
      'name': json['ps'] ?? '',
      'type': 'vmess',
      'server': json['add'] ?? '',
      'port': _toInt(json['port']),
      'uuid': json['id'] ?? '',
      'alterId': _toInt(json['aid']),
      'cipher': json['scy'] ?? 'auto',
      'udp': true,
    };

    if (json['tls'] == 'tls') {
      node['tls'] = true;
    }
    if (json['sni'] != null && json['sni'] != '') {
      node['servername'] = json['sni'];
    }

    final net = json['net'] as String?;
    if (net != null) {
      node['network'] = net;
      switch (net) {
        case 'ws':
          node['ws-opts'] = {
            if (json['path'] != null) 'path': json['path'],
            if (json['host'] != null && json['host'] != '')
              'headers': {'Host': json['host']},
          };
          break;
        case 'grpc':
          node['grpc-opts'] = {
            if (json['path'] != null)
              'grpc-service-name': json['path'],
          };
          break;
        case 'h2':
          node['h2-opts'] = {
            if (json['path'] != null) 'path': json['path'],
            if (json['host'] != null && json['host'] != '')
              'host': [json['host']],
          };
          break;
      }
    }

    return node;
  }

  Map<String, dynamic> _parseVlessLink(String link) {
    final uri = Uri.parse(link);
    final query = uri.queryParameters;

    final node = <String, dynamic>{
      'name': Uri.decodeComponent(uri.fragment),
      'type': 'vless',
      'server': uri.host,
      'port': uri.port,
      'uuid': uri.userInfo,
      'udp': true,
    };

    final security = query['security'];
    if (security == 'tls' || security == 'reality') {
      node['tls'] = true;
    }
    if (query['sni'] != null) {
      node['servername'] = query['sni'];
    }
    if (query['flow'] != null) {
      node['flow'] = query['flow'];
    }

    if (security == 'reality') {
      node['reality-opts'] = {
        if (query['pbk'] != null) 'public-key': query['pbk'],
        if (query['sid'] != null) 'short-id': query['sid'],
      };
    }

    final transport = query['type'] ?? 'tcp';
    node['network'] = transport;

    switch (transport) {
      case 'ws':
        node['ws-opts'] = {
          if (query['path'] != null) 'path': query['path'],
          if (query['host'] != null)
            'headers': {'Host': query['host']},
        };
        break;
      case 'grpc':
        node['grpc-opts'] = {
          if (query['serviceName'] != null)
            'grpc-service-name': query['serviceName'],
        };
        break;
    }

    return node;
  }

  Map<String, dynamic> _parseTrojanLink(String link) {
    final uri = Uri.parse(link);
    final query = uri.queryParameters;

    final node = <String, dynamic>{
      'name': Uri.decodeComponent(uri.fragment),
      'type': 'trojan',
      'server': uri.host,
      'port': uri.port,
      'password': uri.userInfo,
      'tls': true,
      'udp': true,
    };

    final sni = query['sni'] ?? query['peer'];
    if (sni != null) {
      node['sni'] = sni;
    }

    final transport = query['type'] ?? 'tcp';
    if (transport != 'tcp') {
      node['network'] = transport;
      if (transport == 'ws') {
        node['ws-opts'] = {
          if (query['path'] != null) 'path': query['path'],
          if (query['host'] != null)
            'headers': {'Host': query['host']},
        };
      } else if (transport == 'grpc') {
        node['grpc-opts'] = {
          if (query['serviceName'] != null)
            'grpc-service-name': query['serviceName'],
        };
      }
    }

    return node;
  }

  Map<String, dynamic> _parseSSLink(String link) {
    final raw = link.substring('ss://'.length);
    String? name;
    String content = raw;

    final hashIdx = raw.indexOf('#');
    if (hashIdx != -1) {
      name = Uri.decodeComponent(raw.substring(hashIdx + 1));
      content = raw.substring(0, hashIdx);
    }

    String cipher, password, server;
    int port;

    final atIdx = content.lastIndexOf('@');
    if (atIdx != -1) {
      // SIP002 格式
      String userInfo;
      try {
        userInfo =
            utf8.decode(base64Decode(_padBase64(content.substring(0, atIdx))));
      } catch (_) {
        userInfo = content.substring(0, atIdx);
      }

      final parts = userInfo.split(':');
      cipher = parts[0];
      password = parts.sublist(1).join(':');

      final hostPort = content.substring(atIdx + 1);
      final colonIdx = hostPort.lastIndexOf(':');
      server = hostPort.substring(0, colonIdx);
      port = int.parse(hostPort.substring(colonIdx + 1));
    } else {
      // Legacy 格式
      final decoded = utf8.decode(base64Decode(_padBase64(content)));
      final atIdx2 = decoded.lastIndexOf('@');
      final parts = decoded.substring(0, atIdx2).split(':');
      cipher = parts[0];
      password = parts.sublist(1).join(':');

      final hostPort = decoded.substring(atIdx2 + 1);
      final colonIdx = hostPort.lastIndexOf(':');
      server = hostPort.substring(0, colonIdx);
      port = int.parse(hostPort.substring(colonIdx + 1));
    }

    return {
      'name': name ?? '',
      'type': 'ss',
      'server': server,
      'port': port,
      'cipher': cipher,
      'password': password,
      'udp': true,
    };
  }

  Map<String, dynamic> _parseHysteria2Link(String link) {
    final uri = Uri.parse(link);
    final query = uri.queryParameters;

    final node = <String, dynamic>{
      'name': Uri.decodeComponent(uri.fragment),
      'type': 'hysteria2',
      'server': uri.host,
      'port': uri.port,
      'password': uri.userInfo,
      'tls': true,
      'udp': true,
    };

    if (query['sni'] != null) {
      node['sni'] = query['sni'];
    }
    if (query['obfs'] != null) {
      node['obfs'] = query['obfs'];
      node['obfs-password'] = query['obfs-password'];
    }

    return node;
  }

  /// 解析 Clash YAML 格式
  List<Map<String, dynamic>> _parseClashYaml(String content) {
    // Clash YAML 的完整解析交给 FlClash 内置引擎
    // 这里返回空列表，由 pipeline 直传给核心
    return [];
  }

  /// 解析 V2Board JSON 格式
  List<Map<String, dynamic>> _parseV2BoardJSON(String content) {
    final dynamic parsed = jsonDecode(content);
    List<dynamic> servers;

    if (parsed is List) {
      servers = parsed;
    } else if (parsed is Map && parsed.containsKey('data')) {
      servers = parsed['data'] as List;
    } else {
      throw FormatException('无法识别的 V2Board JSON 格式');
    }

    return servers.map((s) {
      final server = s as Map<String, dynamic>;
      return _v2boardServerToNode(server);
    }).toList();
  }

  Map<String, dynamic> _v2boardServerToNode(Map<String, dynamic> server) {
    final type = server['type'] as String? ?? 'vmess';
    final node = <String, dynamic>{
      'name': server['name'] ?? '',
      'server': server['host'] ?? '',
      'port': server['server_port'] ?? server['port'] ?? 443,
      'udp': true,
    };

    switch (type) {
      case 'vmess':
        node['type'] = 'vmess';
        node['uuid'] = server['uuid'] ?? '';
        node['alterId'] = server['alter_id'] ?? 0;
        node['cipher'] = 'auto';
        break;
      case 'vless':
        node['type'] = 'vless';
        node['uuid'] = server['uuid'] ?? '';
        break;
      case 'trojan':
        node['type'] = 'trojan';
        node['password'] = server['uuid'] ?? '';
        node['tls'] = true;
        break;
      case 'shadowsocks':
        node['type'] = 'ss';
        node['cipher'] = server['cipher'] ?? 'aes-256-gcm';
        node['password'] = server['uuid'] ?? '';
        break;
      case 'hysteria':
        node['type'] = 'hysteria2';
        node['password'] = server['uuid'] ?? '';
        node['tls'] = true;
        break;
    }

    // TLS
    if (server['tls'] == 1) {
      node['tls'] = true;
    }
    final tlsSettings = server['tls_settings'] as Map<String, dynamic>?;
    if (tlsSettings != null) {
      if (tlsSettings['server_name'] != null) {
        node['servername'] = tlsSettings['server_name'];
      }
      if (tlsSettings['public_key'] != null) {
        node['reality-opts'] = {
          'public-key': tlsSettings['public_key'],
          if (tlsSettings['short_id'] != null)
            'short-id': tlsSettings['short_id'],
        };
      }
    }

    // 传输协议
    final network = server['network'] as String?;
    if (network != null) {
      node['network'] = network;
      final netSettings =
          server['network_settings'] as Map<String, dynamic>?;
      if (netSettings != null) {
        switch (network) {
          case 'ws':
            node['ws-opts'] = {
              if (netSettings['path'] != null) 'path': netSettings['path'],
              if (netSettings['headers'] != null)
                'headers': netSettings['headers'],
            };
            break;
          case 'grpc':
            node['grpc-opts'] = {
              if (netSettings['serviceName'] != null)
                'grpc-service-name': netSettings['serviceName'],
            };
            break;
        }
      }
    }

    return node;
  }

  // 辅助方法

  TrafficInfo? _parseTrafficInfo(String userInfo) {
    int upload = 0, download = 0, total = 0;
    for (final part in userInfo.split(';')) {
      final kv = part.trim().split('=');
      if (kv.length != 2) continue;
      final val = int.tryParse(kv[1].trim()) ?? 0;
      switch (kv[0].trim()) {
        case 'upload':
          upload = val;
          break;
        case 'download':
          download = val;
          break;
        case 'total':
          total = val;
          break;
      }
    }
    return TrafficInfo(upload: upload, download: download, total: total);
  }

  int? _parseExpireAt(String userInfo) {
    for (final part in userInfo.split(';')) {
      final kv = part.trim().split('=');
      if (kv.length == 2 && kv[0].trim() == 'expire') {
        return int.tryParse(kv[1].trim());
      }
    }
    return null;
  }

  int _toInt(dynamic v) {
    if (v is int) return v;
    if (v is double) return v.toInt();
    if (v is String) return int.tryParse(v) ?? 0;
    return 0;
  }

  String _padBase64(String input) {
    final mod = input.length % 4;
    if (mod != 0) {
      input += '=' * (4 - mod);
    }
    return input;
  }

  void dispose() {
    _client.close();
  }
}

/// 订阅处理结果
class SubscriptionResult {
  final List<Map<String, dynamic>> nodes;
  final Map<String, dynamic> dnsConfig;
  final TrafficInfo? trafficInfo;
  final int? expireAt;

  SubscriptionResult({
    required this.nodes,
    required this.dnsConfig,
    this.trafficInfo,
    this.expireAt,
  });
}

/// 订阅异常
class SubscriptionException implements Exception {
  final String message;
  SubscriptionException(this.message);

  @override
  String toString() => 'SubscriptionException: $message';
}

/// 域名伪装服务（Dart 侧实现，与 Go 核心同步）
class DomainMaskService {
  DomainMaskConfig _config;

  DomainMaskService(this._config);

  DomainMaskConfig get config => _config;

  void updateConfig(DomainMaskConfig config) {
    _config = config;
  }

  /// 对节点列表应用域名伪装
  List<Map<String, dynamic>> applyMasking(
      List<Map<String, dynamic>> nodes) {
    if (!_config.enable) return nodes;

    return nodes.map((node) {
      final masked = Map<String, dynamic>.from(node);

      // 伪装 server
      if (masked['server'] is String) {
        masked['server'] = _maskDomain(masked['server'] as String);
      }

      // 伪装端口
      if (masked['port'] is int) {
        masked['port'] = _maskPort(
          masked['port'] as int,
          masked['server'] as String? ?? '',
        );
      }

      // 伪装 SNI / servername
      for (final key in ['sni', 'servername']) {
        if (masked[key] is String) {
          masked[key] = _maskSNI(masked[key] as String);
        }
      }

      // 伪装 WebSocket Host
      if (masked['ws-opts'] is Map) {
        final wsOpts = Map<String, dynamic>.from(
            masked['ws-opts'] as Map<String, dynamic>);
        if (wsOpts['headers'] is Map) {
          final headers = Map<String, dynamic>.from(
              wsOpts['headers'] as Map<String, dynamic>);
          if (headers['Host'] is String) {
            headers['Host'] = _maskDomain(headers['Host'] as String);
          }
          wsOpts['headers'] = headers;
        }
        masked['ws-opts'] = wsOpts;
      }

      return masked;
    }).toList();
  }

  String _maskDomain(String domain) {
    for (final rule in _config.rules) {
      if (!rule.enabled) continue;
      final result = _applyRule(rule, domain);
      if (result != null) return result;
    }
    return domain;
  }

  int _maskPort(int port, String server) {
    for (final rule in _config.portMapping) {
      if (!rule.enabled) continue;
      if (rule.originalPort == port) {
        if (rule.serverMatch == null ||
            rule.serverMatch!.isEmpty ||
            server.contains(rule.serverMatch!)) {
          return rule.mappedPort;
        }
      }
    }
    return port;
  }

  String _maskSNI(String sni) {
    for (final rule in _config.sniRewrite) {
      if (!rule.enabled) continue;
      if (rule.originalSNI == sni) {
        return rule.newSNI;
      }
    }
    return sni;
  }

  String? _applyRule(MaskRule rule, String domain) {
    switch (rule.matchType) {
      case MatchType.exact:
        if (domain == rule.pattern) return rule.replace;
        break;
      case MatchType.suffix:
        if (domain.endsWith(rule.pattern)) {
          final prefix =
              domain.substring(0, domain.length - rule.pattern.length);
          return prefix + rule.replace;
        }
        break;
      case MatchType.prefix:
        if (domain.startsWith(rule.pattern)) {
          final suffix = domain.substring(rule.pattern.length);
          return rule.replace + suffix;
        }
        break;
      case MatchType.wildcard:
        if (_matchWildcard(domain, rule.pattern)) {
          return rule.replace;
        }
        break;
      case MatchType.regex:
        final regex = RegExp(rule.pattern);
        if (regex.hasMatch(domain)) {
          return domain.replaceFirst(regex, rule.replace);
        }
        break;
    }
    return null;
  }

  bool _matchWildcard(String str, String pattern) {
    final regex = RegExp(
      '^${pattern.replaceAll('.', '\\.').replaceAll('*', '.*')}\$',
    );
    return regex.hasMatch(str);
  }
}

/// DoH 服务（Dart 侧）
class DoHService {
  DoHConfig _config;

  DoHService(this._config);

  DoHConfig get config => _config;

  void updateConfig(DoHConfig config) {
    _config = config;
  }

  /// 生成 clash-meta DNS 配置
  Map<String, dynamic> generateDNSConfig() {
    return _config.toClashDNSConfig();
  }
}
