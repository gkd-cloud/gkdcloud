/// 域名伪装规则数据模型

/// 匹配类型枚举
enum MatchType {
  exact('精确匹配'),
  suffix('后缀匹配'),
  prefix('前缀匹配'),
  wildcard('通配符'),
  regex('正则表达式');

  final String displayName;
  const MatchType(this.displayName);
}

/// 域名伪装规则
class MaskRule {
  final String id;
  final MatchType matchType;
  final String pattern;
  final String replace;
  final String? comment;
  final bool enabled;

  MaskRule({
    required this.id,
    required this.matchType,
    required this.pattern,
    required this.replace,
    this.comment,
    this.enabled = true,
  });

  factory MaskRule.fromJson(Map<String, dynamic> json) {
    return MaskRule(
      id: json['id'] as String? ?? '',
      matchType: MatchType.values.firstWhere(
        (e) => e.name == json['match_type'],
        orElse: () => MatchType.exact,
      ),
      pattern: json['pattern'] as String,
      replace: json['replace'] as String,
      comment: json['comment'] as String?,
      enabled: json['enabled'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'match_type': matchType.name,
        'pattern': pattern,
        'replace': replace,
        if (comment != null) 'comment': comment,
        'enabled': enabled,
      };

  MaskRule copyWith({
    MatchType? matchType,
    String? pattern,
    String? replace,
    String? comment,
    bool? enabled,
  }) {
    return MaskRule(
      id: id,
      matchType: matchType ?? this.matchType,
      pattern: pattern ?? this.pattern,
      replace: replace ?? this.replace,
      comment: comment ?? this.comment,
      enabled: enabled ?? this.enabled,
    );
  }
}

/// 端口映射规则
class PortMapRule {
  final String id;
  final int originalPort;
  final int mappedPort;
  final String? serverMatch;
  final String? comment;
  final bool enabled;

  PortMapRule({
    required this.id,
    required this.originalPort,
    required this.mappedPort,
    this.serverMatch,
    this.comment,
    this.enabled = true,
  });

  factory PortMapRule.fromJson(Map<String, dynamic> json) {
    return PortMapRule(
      id: json['id'] as String? ?? '',
      originalPort: json['original_port'] as int,
      mappedPort: json['mapped_port'] as int,
      serverMatch: json['server_match'] as String?,
      comment: json['comment'] as String?,
      enabled: json['enabled'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'original_port': originalPort,
        'mapped_port': mappedPort,
        if (serverMatch != null) 'server_match': serverMatch,
        if (comment != null) 'comment': comment,
        'enabled': enabled,
      };
}

/// SNI 重写规则
class SNIRewriteRule {
  final String id;
  final String originalSNI;
  final String newSNI;
  final String? comment;
  final bool enabled;

  SNIRewriteRule({
    required this.id,
    required this.originalSNI,
    required this.newSNI,
    this.comment,
    this.enabled = true,
  });

  factory SNIRewriteRule.fromJson(Map<String, dynamic> json) {
    return SNIRewriteRule(
      id: json['id'] as String? ?? '',
      originalSNI: json['original_sni'] as String,
      newSNI: json['new_sni'] as String,
      comment: json['comment'] as String?,
      enabled: json['enabled'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'original_sni': originalSNI,
        'new_sni': newSNI,
        if (comment != null) 'comment': comment,
        'enabled': enabled,
      };
}

/// 完整的域名伪装配置
class DomainMaskConfig {
  final bool enable;
  final List<MaskRule> rules;
  final List<PortMapRule> portMapping;
  final List<SNIRewriteRule> sniRewrite;

  DomainMaskConfig({
    this.enable = false,
    this.rules = const [],
    this.portMapping = const [],
    this.sniRewrite = const [],
  });

  factory DomainMaskConfig.fromJson(Map<String, dynamic> json) {
    return DomainMaskConfig(
      enable: json['enable'] as bool? ?? false,
      rules: (json['rules'] as List<dynamic>?)
              ?.map((e) => MaskRule.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      portMapping: (json['port_mapping'] as List<dynamic>?)
              ?.map(
                  (e) => PortMapRule.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      sniRewrite: (json['sni_rewrite'] as List<dynamic>?)
              ?.map((e) =>
                  SNIRewriteRule.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() => {
        'enable': enable,
        'rules': rules.map((e) => e.toJson()).toList(),
        'port_mapping': portMapping.map((e) => e.toJson()).toList(),
        'sni_rewrite': sniRewrite.map((e) => e.toJson()).toList(),
      };

  DomainMaskConfig copyWith({
    bool? enable,
    List<MaskRule>? rules,
    List<PortMapRule>? portMapping,
    List<SNIRewriteRule>? sniRewrite,
  }) {
    return DomainMaskConfig(
      enable: enable ?? this.enable,
      rules: rules ?? this.rules,
      portMapping: portMapping ?? this.portMapping,
      sniRewrite: sniRewrite ?? this.sniRewrite,
    );
  }

  /// 活跃的域名伪装规则数量
  int get activeRuleCount => rules.where((r) => r.enabled).length;

  /// 活跃的端口映射规则数量
  int get activePortMapCount => portMapping.where((r) => r.enabled).length;

  /// 活跃的 SNI 重写规则数量
  int get activeSNIRewriteCount => sniRewrite.where((r) => r.enabled).length;
}
