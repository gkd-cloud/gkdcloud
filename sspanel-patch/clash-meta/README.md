# Clash Meta 独立模板方案

Mihomo / Clash.Meta 客户端的**完整独立 YAML 模板**，与 SSPanel 面板内置的 Clash 模板完全分离。

---

## 与注入方案的区别

| | 注入方案（`../clashMetaDns.php`）| 本方案（独立模板）|
|--|--|--|
| **配置范围** | 仅修改 `dns:` 节 | 完全控制整个 Clash YAML |
| **proxy-groups** | 继承面板模板 | 完全自定义 |
| **rules** | 继承面板模板 | 完全自定义 |
| **升级兼容** | 自动继承上游 rules 更新 | 需手动维护 |
| **维护成本** | 低 | 中（需同步维护模板）|
| **适用场景** | 只需加 nameserver-policy | 需要不同的分流策略、代理组结构 |

**两套方案可以共存**：LinkController 优先尝试本方案（模板文件存在时），模板不存在时自动降级到注入方案。

---

## 文件清单

| 文件 | 部署到 SSPanel | 说明 |
|------|--------------|------|
| `ClashMetaConf.php` | `src/Utils/ClashMetaConf.php` | PHP 渲染器（读取模板 + 注入代理节点）|
| `template.yaml` | `config/clash-meta-template.yaml` | Clash YAML 模板（用户维护此文件）|
| 修改 `../LinkController.php` | `src/Controllers/LinkController.php` | 见下方「LinkController 改动」|

---

## 部署步骤

### 第 1 步：复制文件

```bash
SSPANEL=/www/wwwroot/你的SSPanel根目录

# 渲染器类
cp ClashMetaConf.php  $SSPANEL/src/Utils/ClashMetaConf.php

# YAML 模板（核心，用户自行编辑）
cp template.yaml      $SSPANEL/config/clash-meta-template.yaml
```

### 第 2 步：修改 LinkController.php

在已有补丁的 `src/Controllers/LinkController.php` 基础上做以下两处改动：

#### 改动 A — use 声明区加入 `ClashMetaConf`

找到文件顶部的 `use App\Utils\{...}` 块，加入 `ClashMetaConf`：

```php
use App\Utils\{
    URL,
    Tools,
    AppURI,
    ConfRender,
    DomainReplacer,
    ClashMetaConf    // ← 新增
};
```

#### 改动 B — `getClash()` 中增加模板优先逻辑

找到 `getClash()` 方法内的这段代码（已有注入方案的版本）：

```php
$yaml = ConfController::getClashConfs($user, $Proxys, $_ENV['Clash_Profiles'][$Profiles]);

// --- Mihomo 客户端 DNS 增强 开始 ---
if (self::isMihomoClient($opts['_ua'] ?? '')) {
    $yaml = self::injectMihomoConfig($yaml);
}
// --- Mihomo 客户端 DNS 增强 结束 ---

return $yaml;
```

替换为：

```php
// --- Mihomo 客户端 DNS 增强 开始 ---
$isMihomo = self::isMihomoClient($opts['_ua'] ?? '');

if ($isMihomo) {
    // 方案一（优先）：独立 YAML 模板 (config/clash-meta-template.yaml)
    // 模板文件存在时直接返回，不调用 ConfController
    $metaYaml = ClashMetaConf::render($user, $Proxys);
    if ($metaYaml !== '') {
        return $metaYaml;
    }
}

// 方案二：面板默认配置 + dns 注入（模板未部署时自动降级）
$yaml = ConfController::getClashConfs($user, $Proxys, $_ENV['Clash_Profiles'][$Profiles]);

if ($isMihomo) {
    $yaml = self::injectMihomoConfig($yaml);
}
// --- Mihomo 客户端 DNS 增强 结束 ---

return $yaml;
```

### 第 3 步：自定义模板

编辑 `$SSPANEL/config/clash-meta-template.yaml`，按注释修改：

```
修改位置速查：

  DNS 相关（核心）：
    第 56 行  nameserver          → 主 DNS 服务器
    第 70 行  fallback            → Fallback DNS
    第 76 行  fallback-filter     → 触发 fallback 的条件
    第 94 行  nameserver-policy   → 按域名/geosite 指定 DNS ← 最常改这里

  代理组：
    第 135 行 proxy-groups        → 修改分组策略、添加地区分组

  规则：
    第 169 行 rules               → 修改分流规则顺序和策略
```

---

## 模板机制说明

### `proxies: []`

`proxies:` 这一 key 的值会被 SSPanel 自动替换为用户账号下的全部代理节点，保留该 key 即可，无需手动填写。

### `__ALL__` 占位符

在 `proxy-groups` 的 `proxies` 列表中写 `__ALL__`，会被自动展开为所有代理节点的名称列表。可以在 `__ALL__` 前后添加固定条目：

```yaml
proxy-groups:
  - name: "🚀 节点选择"
    type: select
    proxies:
      - "♻️ 自动选择"   # 固定条目（在节点列表前）
      - __ALL__          # ← 展开后：节点A、节点B、节点C...
      - DIRECT           # 固定条目（在节点列表后，可选）
```

**展开后等价于：**
```yaml
      - "♻️ 自动选择"
      - 节点A
      - 节点B
      - 节点C
      - DIRECT
```

### filter 字段筛选节点

如果想按关键词筛选节点（例如只选香港节点），可以用 `filter`：

```yaml
proxy-groups:
  - name: "🇭🇰 香港"
    type: url-test
    proxies:
      - __ALL__
    filter: "香港|HK|Hong Kong"   # 只保留名称匹配的节点
    url: https://www.gstatic.com/generate_204
    interval: 300
```

> **注意**：`filter` 是 Mihomo 核心功能，仅 Mihomo/Clash.Meta 系列客户端支持，Clash for Windows 不支持。

---

## 降级机制

```
Mihomo 客户端请求订阅
        ↓
  isMihomoClient() = true
        ↓
  ClashMetaConf::render()
        ├── config/clash-meta-template.yaml 存在 → 返回完整模板 YAML ✅
        │
        └── 文件不存在 / 解析失败 → 返回 ''
                ↓
          ConfController::getClashConfs()  （面板默认配置）
                ↓
          injectMihomoConfig()  （注入 clashMetaDns.php 的 dns 配置）
```

删除 `config/clash-meta-template.yaml` 即可临时切换回注入方案，无需改代码。

---

## 验证方法

```bash
SSPANEL_URL=https://你的订阅域名
TOKEN=你的订阅Token

# 1. 验证 Mihomo 客户端收到独立模板（应包含 fake-ip-range、nameserver-policy 等）
curl -s -A "clash.meta/1.18.0" "$SSPANEL_URL/link/$TOKEN?clash=1" \
  | grep -E "fake-ip-range|nameserver-policy|__ALL__|geosite"

# 2. 确认 #!MANAGED-CONFIG 注释头存在（Clash Verge 托管配置依赖此标志）
curl -s -A "clash.meta/1.18.0" "$SSPANEL_URL/link/$TOKEN?clash=1" | head -3

# 3. 普通 Clash 客户端不受影响（应收到面板默认配置）
curl -s -A "ClashForWindows/0.20.0" "$SSPANEL_URL/link/$TOKEN?clash=1" \
  | grep "nameserver-policy"
# 期望：无输出（默认配置不含此字段）

# 4. 降级验证（重命名模板文件，应自动降级到注入方案）
mv $SSPANEL/config/clash-meta-template.yaml /tmp/clash-meta-template.yaml.bak
curl -s -A "clash.meta/1.18.0" "$SSPANEL_URL/link/$TOKEN?clash=1" | head -5
# 期望：正常返回 YAML（来自注入方案）
mv /tmp/clash-meta-template.yaml.bak $SSPANEL/config/clash-meta-template.yaml
```

---

## 常见问题

**Q: 代理组里没有节点（空列表）？**
A: 检查 `proxies: []` 这一行是否存在于模板中。如果模板中没有该 key，SSPanel 无法注入节点。

**Q: `__ALL__` 没有被展开？**
A: 检查 `ClashMetaConf.php` 是否已正确部署到 `src/Utils/`，以及 `use ... ClashMetaConf` 是否已加入 `LinkController.php`。

**Q: Clash Verge 显示「不是托管配置」？**
A: 确认 `$_ENV['baseUrl']` 已在 SSPanel 的 `.env` 中正确配置，`render()` 需要它来构建 `#!MANAGED-CONFIG` URL。

**Q: 想给不同地区的节点建立单独代理组？**
A: 在 `template.yaml` 的 `proxy-groups` 中添加带 `filter` 字段的组，并在「节点选择」组的 `proxies` 中引用它们（见模板注释示例）。

**Q: 想完全禁用本方案，只用注入方案？**
A: 删除或不部署 `config/clash-meta-template.yaml` 即可，无需改动任何 PHP 文件。
