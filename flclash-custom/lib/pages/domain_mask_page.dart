import 'package:flutter/material.dart';
import '../models/mask_rule.dart';

/// 域名伪装设置页面
class DomainMaskPage extends StatefulWidget {
  final DomainMaskConfig config;
  final ValueChanged<DomainMaskConfig> onConfigChanged;

  const DomainMaskPage({
    super.key,
    required this.config,
    required this.onConfigChanged,
  });

  @override
  State<DomainMaskPage> createState() => _DomainMaskPageState();
}

class _DomainMaskPageState extends State<DomainMaskPage>
    with SingleTickerProviderStateMixin {
  late DomainMaskConfig _config;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _config = widget.config;
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _updateConfig(DomainMaskConfig newConfig) {
    setState(() => _config = newConfig);
    widget.onConfigChanged(newConfig);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('域名伪装设置'),
        actions: [
          Switch(
            value: _config.enable,
            onChanged: (v) =>
                _updateConfig(_config.copyWith(enable: v)),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(
              text: '域名规则 (${_config.activeRuleCount})',
            ),
            Tab(
              text: '端口映射 (${_config.activePortMapCount})',
            ),
            Tab(
              text: 'SNI 重写 (${_config.activeSNIRewriteCount})',
            ),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildDomainRulesTab(),
          _buildPortMappingTab(),
          _buildSNIRewriteTab(),
        ],
      ),
    );
  }

  // ===== 域名规则 Tab =====
  Widget _buildDomainRulesTab() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(8),
          child: Text(
            '将面板下发的节点域名替换为伪装域名',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ),
        Expanded(
          child: _config.rules.isEmpty
              ? const Center(child: Text('暂无域名伪装规则'))
              : ListView.builder(
                  itemCount: _config.rules.length,
                  itemBuilder: (ctx, index) {
                    final rule = _config.rules[index];
                    return _buildDomainRuleCard(rule, index);
                  },
                ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton.icon(
            onPressed: _showAddDomainRuleDialog,
            icon: const Icon(Icons.add),
            label: const Text('添加域名规则'),
          ),
        ),
      ],
    );
  }

  Widget _buildDomainRuleCard(MaskRule rule, int index) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: ExpansionTile(
        leading: Switch(
          value: rule.enabled,
          onChanged: (v) {
            final updated = [..._config.rules];
            updated[index] = rule.copyWith(enabled: v);
            _updateConfig(_config.copyWith(rules: updated));
          },
        ),
        title: Text(rule.pattern),
        subtitle: Text(
          '${rule.matchType.displayName} -> ${rule.replace}',
          style: TextStyle(
            color: rule.enabled ? null : Colors.grey,
          ),
        ),
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (rule.comment != null && rule.comment!.isNotEmpty)
                  Text('备注: ${rule.comment}'),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton.icon(
                      onPressed: () => _showEditDomainRuleDialog(rule, index),
                      icon: const Icon(Icons.edit, size: 18),
                      label: const Text('编辑'),
                    ),
                    TextButton.icon(
                      onPressed: () {
                        final updated = [..._config.rules]
                          ..removeAt(index);
                        _updateConfig(
                            _config.copyWith(rules: updated));
                      },
                      icon: const Icon(Icons.delete, size: 18),
                      label: const Text('删除'),
                      style: TextButton.styleFrom(
                          foregroundColor: Colors.red),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===== 端口映射 Tab =====
  Widget _buildPortMappingTab() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(8),
          child: Text(
            '将节点端口映射到其他端口，避免常见端口被封',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ),
        Expanded(
          child: _config.portMapping.isEmpty
              ? const Center(child: Text('暂无端口映射规则'))
              : ListView.builder(
                  itemCount: _config.portMapping.length,
                  itemBuilder: (ctx, index) {
                    final rule = _config.portMapping[index];
                    return ListTile(
                      leading: Switch(
                        value: rule.enabled,
                        onChanged: (v) {
                          final updated = [..._config.portMapping];
                          updated[index] = PortMapRule(
                            id: rule.id,
                            originalPort: rule.originalPort,
                            mappedPort: rule.mappedPort,
                            serverMatch: rule.serverMatch,
                            comment: rule.comment,
                            enabled: v,
                          );
                          _updateConfig(_config.copyWith(
                              portMapping: updated));
                        },
                      ),
                      title: Text(
                          '${rule.originalPort} -> ${rule.mappedPort}'),
                      subtitle: Text(rule.comment ?? ''),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete),
                        onPressed: () {
                          final updated = [..._config.portMapping]
                            ..removeAt(index);
                          _updateConfig(
                              _config.copyWith(portMapping: updated));
                        },
                      ),
                    );
                  },
                ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton.icon(
            onPressed: _showAddPortMapDialog,
            icon: const Icon(Icons.add),
            label: const Text('添加端口映射'),
          ),
        ),
      ],
    );
  }

  // ===== SNI 重写 Tab =====
  Widget _buildSNIRewriteTab() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(8),
          child: Text(
            '重写 TLS 握手中的 SNI，伪装为其他域名',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ),
        Expanded(
          child: _config.sniRewrite.isEmpty
              ? const Center(child: Text('暂无 SNI 重写规则'))
              : ListView.builder(
                  itemCount: _config.sniRewrite.length,
                  itemBuilder: (ctx, index) {
                    final rule = _config.sniRewrite[index];
                    return ListTile(
                      leading: Switch(
                        value: rule.enabled,
                        onChanged: (v) {
                          final updated = [..._config.sniRewrite];
                          updated[index] = SNIRewriteRule(
                            id: rule.id,
                            originalSNI: rule.originalSNI,
                            newSNI: rule.newSNI,
                            comment: rule.comment,
                            enabled: v,
                          );
                          _updateConfig(
                              _config.copyWith(sniRewrite: updated));
                        },
                      ),
                      title: Text(
                          '${rule.originalSNI} -> ${rule.newSNI}'),
                      subtitle: Text(rule.comment ?? ''),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete),
                        onPressed: () {
                          final updated = [..._config.sniRewrite]
                            ..removeAt(index);
                          _updateConfig(
                              _config.copyWith(sniRewrite: updated));
                        },
                      ),
                    );
                  },
                ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton.icon(
            onPressed: _showAddSNIRewriteDialog,
            icon: const Icon(Icons.add),
            label: const Text('添加 SNI 重写'),
          ),
        ),
      ],
    );
  }

  // ===== 对话框 =====

  void _showAddDomainRuleDialog() {
    _showDomainRuleDialog(
      title: '添加域名规则',
      onSave: (rule) {
        final updated = [..._config.rules, rule];
        _updateConfig(_config.copyWith(rules: updated));
      },
    );
  }

  void _showEditDomainRuleDialog(MaskRule existing, int index) {
    _showDomainRuleDialog(
      title: '编辑域名规则',
      existing: existing,
      onSave: (rule) {
        final updated = [..._config.rules];
        updated[index] = rule;
        _updateConfig(_config.copyWith(rules: updated));
      },
    );
  }

  void _showDomainRuleDialog({
    required String title,
    MaskRule? existing,
    required ValueChanged<MaskRule> onSave,
  }) {
    final patternController =
        TextEditingController(text: existing?.pattern ?? '');
    final replaceController =
        TextEditingController(text: existing?.replace ?? '');
    final commentController =
        TextEditingController(text: existing?.comment ?? '');
    var matchType = existing?.matchType ?? MatchType.exact;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text(title),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // 匹配类型
                DropdownButtonFormField<MatchType>(
                  value: matchType,
                  decoration:
                      const InputDecoration(labelText: '匹配类型'),
                  items: MatchType.values
                      .map((t) => DropdownMenuItem(
                            value: t,
                            child: Text(t.displayName),
                          ))
                      .toList(),
                  onChanged: (v) {
                    if (v != null) {
                      setDialogState(() => matchType = v);
                    }
                  },
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: patternController,
                  decoration: InputDecoration(
                    labelText: '匹配模式',
                    hintText: _getPatternHint(matchType),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: replaceController,
                  decoration: const InputDecoration(
                    labelText: '替换为',
                    hintText: 'cdn.masked-domain.com',
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: commentController,
                  decoration: const InputDecoration(
                    labelText: '备注（可选）',
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('取消'),
            ),
            FilledButton(
              onPressed: () {
                if (patternController.text.isNotEmpty &&
                    replaceController.text.isNotEmpty) {
                  onSave(MaskRule(
                    id: existing?.id ??
                        DateTime.now().millisecondsSinceEpoch.toString(),
                    matchType: matchType,
                    pattern: patternController.text,
                    replace: replaceController.text,
                    comment: commentController.text.isEmpty
                        ? null
                        : commentController.text,
                  ));
                  Navigator.pop(ctx);
                }
              },
              child: const Text('保存'),
            ),
          ],
        ),
      ),
    );
  }

  void _showAddPortMapDialog() {
    final origController = TextEditingController();
    final mappedController = TextEditingController();
    final serverController = TextEditingController();
    final commentController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('添加端口映射'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: origController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: '原始端口',
                hintText: '443',
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: mappedController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: '映射端口',
                hintText: '8443',
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: serverController,
              decoration: const InputDecoration(
                labelText: '服务器匹配（可选）',
                hintText: '留空则全局生效',
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: commentController,
              decoration: const InputDecoration(
                labelText: '备注（可选）',
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
              final orig = int.tryParse(origController.text);
              final mapped = int.tryParse(mappedController.text);
              if (orig != null && mapped != null) {
                final updated = [
                  ..._config.portMapping,
                  PortMapRule(
                    id: DateTime.now()
                        .millisecondsSinceEpoch
                        .toString(),
                    originalPort: orig,
                    mappedPort: mapped,
                    serverMatch: serverController.text.isEmpty
                        ? null
                        : serverController.text,
                    comment: commentController.text.isEmpty
                        ? null
                        : commentController.text,
                  ),
                ];
                _updateConfig(
                    _config.copyWith(portMapping: updated));
                Navigator.pop(ctx);
              }
            },
            child: const Text('添加'),
          ),
        ],
      ),
    );
  }

  void _showAddSNIRewriteDialog() {
    final origController = TextEditingController();
    final newController = TextEditingController();
    final commentController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('添加 SNI 重写'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: origController,
              decoration: const InputDecoration(
                labelText: '原始 SNI',
                hintText: 'node1.real-domain.com',
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: newController,
              decoration: const InputDecoration(
                labelText: '替换为',
                hintText: 'www.microsoft.com',
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: commentController,
              decoration: const InputDecoration(
                labelText: '备注（可选）',
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
              if (origController.text.isNotEmpty &&
                  newController.text.isNotEmpty) {
                final updated = [
                  ..._config.sniRewrite,
                  SNIRewriteRule(
                    id: DateTime.now()
                        .millisecondsSinceEpoch
                        .toString(),
                    originalSNI: origController.text,
                    newSNI: newController.text,
                    comment: commentController.text.isEmpty
                        ? null
                        : commentController.text,
                  ),
                ];
                _updateConfig(
                    _config.copyWith(sniRewrite: updated));
                Navigator.pop(ctx);
              }
            },
            child: const Text('添加'),
          ),
        ],
      ),
    );
  }

  String _getPatternHint(MatchType type) {
    switch (type) {
      case MatchType.exact:
        return 'node1.real-domain.com';
      case MatchType.suffix:
        return '.real-domain.com';
      case MatchType.prefix:
        return 'node';
      case MatchType.wildcard:
        return '*.real-domain.com';
      case MatchType.regex:
        return r'node(\d+)\.example\.com';
    }
  }
}
