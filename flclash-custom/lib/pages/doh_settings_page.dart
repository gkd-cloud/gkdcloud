import 'package:flutter/material.dart';
import '../models/doh_config.dart';

/// DoH 设置页面
class DoHSettingsPage extends StatefulWidget {
  final DoHConfig config;
  final ValueChanged<DoHConfig> onConfigChanged;

  const DoHSettingsPage({
    super.key,
    required this.config,
    required this.onConfigChanged,
  });

  @override
  State<DoHSettingsPage> createState() => _DoHSettingsPageState();
}

class _DoHSettingsPageState extends State<DoHSettingsPage> {
  late DoHConfig _config;
  bool _isTesting = false;
  Map<String, DoHSpeedTestResult> _testResults = {};

  @override
  void initState() {
    super.initState();
    _config = widget.config;
  }

  void _updateConfig(DoHConfig newConfig) {
    setState(() => _config = newConfig);
    widget.onConfigChanged(newConfig);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('自定义 DoH 设置'),
        actions: [
          IconButton(
            icon: const Icon(Icons.speed),
            tooltip: '测速',
            onPressed: _isTesting ? null : _runSpeedTest,
          ),
          IconButton(
            icon: const Icon(Icons.restore),
            tooltip: '恢复默认',
            onPressed: () =>
                _updateConfig(DoHConfig.defaultConfig()),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 策略选择
          _buildStrategySection(),
          const SizedBox(height: 16),

          // 主要 DoH 服务器
          _buildServerSection(
            title: '主要 DoH 服务器',
            servers: _config.servers,
            onServersChanged: (servers) =>
                _updateConfig(_config.copyWith(servers: servers)),
          ),
          const SizedBox(height: 16),

          // 备用 DoH 服务器
          _buildServerSection(
            title: '备用 DoH 服务器',
            servers: _config.fallbackServers,
            onServersChanged: (servers) =>
                _updateConfig(_config.copyWith(fallbackServers: servers)),
          ),
          const SizedBox(height: 16),

          // 引导 DNS
          _buildBootstrapSection(),
          const SizedBox(height: 16),

          // 高级设置
          _buildAdvancedSection(),
          const SizedBox(height: 16),

          // 静态 Host 映射
          _buildHostMappingSection(),
        ],
      ),
    );
  }

  Widget _buildStrategySection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('选择策略',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            SegmentedButton<DoHStrategy>(
              segments: DoHStrategy.values
                  .map((s) => ButtonSegment(
                        value: s,
                        label: Text(s.displayName),
                      ))
                  .toList(),
              selected: {_config.strategy},
              onSelectionChanged: (selected) => _updateConfig(
                _config.copyWith(strategy: selected.first),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildServerSection({
    required String title,
    required List<DoHServerConfig> servers,
    required ValueChanged<List<DoHServerConfig>> onServersChanged,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(title,
                    style: Theme.of(context).textTheme.titleMedium),
                IconButton(
                  icon: const Icon(Icons.add),
                  onPressed: () => _showAddServerDialog(
                    onAdd: (server) {
                      final updated = [...servers, server];
                      onServersChanged(updated);
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ...servers.asMap().entries.map((entry) {
              final index = entry.key;
              final server = entry.value;
              final testResult = _testResults[server.url];

              return ListTile(
                leading: const Icon(Icons.dns),
                title: Text(server.name),
                subtitle: Text(server.url),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (testResult != null)
                      Chip(
                        label: Text(
                          testResult.formattedLatency,
                          style: TextStyle(
                            color: testResult.available
                                ? Colors.green
                                : Colors.red,
                          ),
                        ),
                      ),
                    IconButton(
                      icon: const Icon(Icons.edit),
                      onPressed: () => _showEditServerDialog(
                        server: server,
                        onEdit: (edited) {
                          final updated = [...servers];
                          updated[index] = edited;
                          onServersChanged(updated);
                        },
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete),
                      onPressed: () {
                        final updated = [...servers]..removeAt(index);
                        onServersChanged(updated);
                      },
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildBootstrapSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('引导 DNS',
                    style: Theme.of(context).textTheme.titleMedium),
                IconButton(
                  icon: const Icon(Icons.add),
                  onPressed: _showAddBootstrapDialog,
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '用于解析 DoH 服务器域名（必须是 IP 地址）',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: _config.bootstrap.asMap().entries.map((entry) {
                return Chip(
                  label: Text(entry.value),
                  onDeleted: () {
                    final updated = [..._config.bootstrap]
                      ..removeAt(entry.key);
                    _updateConfig(_config.copyWith(bootstrap: updated));
                  },
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAdvancedSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('高级设置',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            SwitchListTile(
              title: const Text('启用 IPv6'),
              subtitle: const Text('解析 AAAA 记录'),
              value: _config.enableIPv6,
              onChanged: (v) =>
                  _updateConfig(_config.copyWith(enableIPv6: v)),
            ),
            ListTile(
              title: const Text('缓存 TTL'),
              subtitle: Text('${_config.cacheTTL} 秒'),
              trailing: SizedBox(
                width: 100,
                child: TextFormField(
                  initialValue: _config.cacheTTL.toString(),
                  keyboardType: TextInputType.number,
                  onChanged: (v) {
                    final ttl = int.tryParse(v);
                    if (ttl != null && ttl >= 0) {
                      _updateConfig(_config.copyWith(cacheTTL: ttl));
                    }
                  },
                ),
              ),
            ),
            ListTile(
              title: const Text('缓存大小'),
              subtitle: Text('${_config.cacheSize} 条'),
              trailing: SizedBox(
                width: 100,
                child: TextFormField(
                  initialValue: _config.cacheSize.toString(),
                  keyboardType: TextInputType.number,
                  onChanged: (v) {
                    final size = int.tryParse(v);
                    if (size != null && size > 0) {
                      _updateConfig(_config.copyWith(cacheSize: size));
                    }
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHostMappingSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('静态 Host 映射',
                    style: Theme.of(context).textTheme.titleMedium),
                IconButton(
                  icon: const Icon(Icons.add),
                  onPressed: _showAddHostMappingDialog,
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '类似 hosts 文件，直接映射域名到 IP',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 8),
            ..._config.hostMapping.entries.map((entry) {
              return ListTile(
                title: Text(entry.key),
                subtitle: Text('-> ${entry.value}'),
                trailing: IconButton(
                  icon: const Icon(Icons.delete),
                  onPressed: () {
                    final updated = Map<String, String>.from(
                        _config.hostMapping)
                      ..remove(entry.key);
                    _updateConfig(
                        _config.copyWith(hostMapping: updated));
                  },
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  // 对话框方法

  void _showAddServerDialog({required ValueChanged<DoHServerConfig> onAdd}) {
    final urlController = TextEditingController();
    final nameController = TextEditingController();
    final ipController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('添加 DoH 服务器'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: const InputDecoration(
                labelText: '名称',
                hintText: '如: Cloudflare',
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: urlController,
              decoration: const InputDecoration(
                labelText: 'DoH URL',
                hintText: 'https://1.1.1.1/dns-query',
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: ipController,
              decoration: const InputDecoration(
                labelText: '直连 IP（可选）',
                hintText: '跳过 DNS 解析，直接连接',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () {
              if (urlController.text.isNotEmpty &&
                  nameController.text.isNotEmpty) {
                onAdd(DoHServerConfig(
                  url: urlController.text,
                  name: nameController.text,
                  ip: ipController.text.isEmpty
                      ? null
                      : ipController.text,
                ));
                Navigator.pop(ctx);
              }
            },
            child: const Text('添加'),
          ),
        ],
      ),
    );
  }

  void _showEditServerDialog({
    required DoHServerConfig server,
    required ValueChanged<DoHServerConfig> onEdit,
  }) {
    final urlController = TextEditingController(text: server.url);
    final nameController = TextEditingController(text: server.name);
    final ipController = TextEditingController(text: server.ip ?? '');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('编辑 DoH 服务器'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: const InputDecoration(labelText: '名称'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: urlController,
              decoration: const InputDecoration(labelText: 'DoH URL'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: ipController,
              decoration: const InputDecoration(
                labelText: '直连 IP（可选）',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () {
              onEdit(server.copyWith(
                url: urlController.text,
                name: nameController.text,
                ip: ipController.text.isEmpty
                    ? null
                    : ipController.text,
              ));
              Navigator.pop(ctx);
            },
            child: const Text('保存'),
          ),
        ],
      ),
    );
  }

  void _showAddBootstrapDialog() {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('添加引导 DNS'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: 'IP 地址',
            hintText: '如: 1.1.1.1',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () {
              if (controller.text.isNotEmpty) {
                final updated = [..._config.bootstrap, controller.text];
                _updateConfig(_config.copyWith(bootstrap: updated));
                Navigator.pop(ctx);
              }
            },
            child: const Text('添加'),
          ),
        ],
      ),
    );
  }

  void _showAddHostMappingDialog() {
    final domainController = TextEditingController();
    final ipController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('添加 Host 映射'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: domainController,
              decoration: const InputDecoration(
                labelText: '域名',
                hintText: 'example.com',
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: ipController,
              decoration: const InputDecoration(
                labelText: 'IP 地址',
                hintText: '1.2.3.4',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () {
              if (domainController.text.isNotEmpty &&
                  ipController.text.isNotEmpty) {
                final updated = Map<String, String>.from(
                    _config.hostMapping)
                  ..[domainController.text] = ipController.text;
                _updateConfig(
                    _config.copyWith(hostMapping: updated));
                Navigator.pop(ctx);
              }
            },
            child: const Text('添加'),
          ),
        ],
      ),
    );
  }

  Future<void> _runSpeedTest() async {
    setState(() {
      _isTesting = true;
      _testResults.clear();
    });

    // 实际测速逻辑通过 Go 核心执行
    // 这里模拟调用 platform channel
    // 在真实实现中，通过 MethodChannel 调用 Go 端的 SpeedTest
    await Future.delayed(const Duration(seconds: 2));

    setState(() => _isTesting = false);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('测速完成')),
      );
    }
  }
}
