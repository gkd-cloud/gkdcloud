# FlClash 源码补丁说明

本目录存放需要对 FlClash 源码进行的修改补丁。

## 补丁生成方式

在修改 FlClash 源码后，使用以下命令生成补丁：

```bash
cd FlClash
git diff > ../flclash-custom/patches/001-custom-features.patch
```

## 需要修改的关键位置

### 1. 订阅处理 (subscription)

**文件**: `lib/manager/profile_manager.dart` (或类似)

需要在订阅获取流程中插入自定义处理管线：

```dart
// 原始流程: 获取订阅 -> 解析 -> 加载
// 修改为:   获取订阅 -> 解析 -> 域名伪装 -> 注入DoH -> 加载
```

### 2. DNS 配置注入

**文件**: `core/config.go` 或 clash-meta 配置生成处

在生成 clash 配置时，注入自定义 DoH 配置到 `dns` 段：

```go
// 在配置生成函数中添加:
if customDNS := getCustomDoHConfig(); customDNS != nil {
    config.DNS = customDNS.ToClashDNS()
}
```

### 3. 设置页面入口

**文件**: `lib/pages/settings.dart`

添加两个新的设置入口：
- "自定义 DoH" -> DoHSettingsPage
- "域名伪装"   -> DomainMaskPage

### 4. Platform Channel 桥接

**文件**: `lib/main.dart` 或 platform channel 注册处

注册自定义的 MethodChannel，用于 Dart <-> Go 通信：

```dart
static const _channel = MethodChannel('com.gkdcloud.client/custom');

// 调用 Go 端 DoH 测速
Future<Map<String, int>> speedTestDoH() async {
  final result = await _channel.invokeMethod('speedTestDoH');
  return Map<String, int>.from(result);
}

// 调用 Go 端域名伪装
Future<String> maskDomain(String domain) async {
  return await _channel.invokeMethod('maskDomain', {'domain': domain});
}
```

## 注意事项

1. 补丁应基于 FlClash 的稳定 release 版本生成
2. FlClash 更新后需要重新检查补丁兼容性
3. 建议使用 `git apply --check` 先检查补丁是否可以应用
4. 如果补丁冲突，需要手动合并修改
