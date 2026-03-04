/// 订阅配置数据模型

/// 面板类型枚举
enum PanelType {
  sspanel('SSPanel-Metron'),
  v2board('V2Board');

  final String displayName;
  const PanelType(this.displayName);
}

/// 订阅配置
class SubscriptionConfig {
  final String id;
  final String name;
  final String url;
  final PanelType panelType;
  final bool autoUpdate;
  final int updateIntervalMinutes;
  final DateTime? lastUpdate;
  final TrafficInfo? trafficInfo;
  final int? expireTimestamp;

  SubscriptionConfig({
    required this.id,
    required this.name,
    required this.url,
    required this.panelType,
    this.autoUpdate = true,
    this.updateIntervalMinutes = 60,
    this.lastUpdate,
    this.trafficInfo,
    this.expireTimestamp,
  });

  factory SubscriptionConfig.fromJson(Map<String, dynamic> json) {
    return SubscriptionConfig(
      id: json['id'] as String,
      name: json['name'] as String,
      url: json['url'] as String,
      panelType: PanelType.values.firstWhere(
        (e) => e.name == json['panel_type'],
        orElse: () => PanelType.sspanel,
      ),
      autoUpdate: json['auto_update'] as bool? ?? true,
      updateIntervalMinutes: json['update_interval'] as int? ?? 60,
      lastUpdate: json['last_update'] != null
          ? DateTime.parse(json['last_update'] as String)
          : null,
      trafficInfo: json['traffic'] != null
          ? TrafficInfo.fromJson(json['traffic'] as Map<String, dynamic>)
          : null,
      expireTimestamp: json['expire_at'] as int?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'url': url,
        'panel_type': panelType.name,
        'auto_update': autoUpdate,
        'update_interval': updateIntervalMinutes,
        'last_update': lastUpdate?.toIso8601String(),
        'traffic': trafficInfo?.toJson(),
        'expire_at': expireTimestamp,
      };

  SubscriptionConfig copyWith({
    String? name,
    String? url,
    PanelType? panelType,
    bool? autoUpdate,
    int? updateIntervalMinutes,
    DateTime? lastUpdate,
    TrafficInfo? trafficInfo,
    int? expireTimestamp,
  }) {
    return SubscriptionConfig(
      id: id,
      name: name ?? this.name,
      url: url ?? this.url,
      panelType: panelType ?? this.panelType,
      autoUpdate: autoUpdate ?? this.autoUpdate,
      updateIntervalMinutes:
          updateIntervalMinutes ?? this.updateIntervalMinutes,
      lastUpdate: lastUpdate ?? this.lastUpdate,
      trafficInfo: trafficInfo ?? this.trafficInfo,
      expireTimestamp: expireTimestamp ?? this.expireTimestamp,
    );
  }

  /// 是否已过期
  bool get isExpired {
    if (expireTimestamp == null) return false;
    return DateTime.now().millisecondsSinceEpoch ~/ 1000 > expireTimestamp!;
  }

  /// 格式化的过期时间
  String get formattedExpireDate {
    if (expireTimestamp == null) return '未知';
    final date =
        DateTime.fromMillisecondsSinceEpoch(expireTimestamp! * 1000);
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }
}

/// 流量信息
class TrafficInfo {
  final int upload;
  final int download;
  final int total;

  TrafficInfo({
    required this.upload,
    required this.download,
    required this.total,
  });

  factory TrafficInfo.fromJson(Map<String, dynamic> json) {
    return TrafficInfo(
      upload: json['upload'] as int? ?? 0,
      download: json['download'] as int? ?? 0,
      total: json['total'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'upload': upload,
        'download': download,
        'total': total,
      };

  /// 已使用流量
  int get used => upload + download;

  /// 剩余流量
  int get remaining => total > 0 ? total - used : 0;

  /// 使用百分比
  double get usagePercent => total > 0 ? used / total : 0;

  /// 格式化流量大小
  static String formatBytes(int bytes) {
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    int i = 0;
    double size = bytes.toDouble();
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return '${size.toStringAsFixed(2)} ${units[i]}';
  }

  String get formattedUsed => formatBytes(used);
  String get formattedTotal => formatBytes(total);
  String get formattedRemaining => formatBytes(remaining);
}
