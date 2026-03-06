# Clash Meta 独立模板方案

为 Mihomo / Clash.Meta 核心客户端（FlClash、Clash Verge 等）提供独立的完整 Clash 配置模板，
与 SSPanel 面板内置模板完全分离，可自由定制 DNS、代理组、分流规则。

普通 Clash 客户端（Clash for Windows 等）不受影响，继续收到面板默认配置。

---

## 文件清单

| 文件 | 部署到 SSPanel | 说明 |
|------|--------------|------|
| `ClashMetaConf.php` | `src/Utils/ClashMetaConf.php` | PHP 渲染器（读取模板 + 注入节点）|
| `template.yaml` | `config/clash-meta-template.yaml` | Clash 配置模板（用户维护此文件）|
| 修改 `../LinkController.php` | `src/Controllers/LinkController.php` | 见下方「LinkController 改动」|

---

## 部署步骤

### 第 1 步：复制文件

```bash
SSPANEL=/www/wwwroot/你的SSPanel根目录

cp ClashMetaConf.php  $SSPANEL/src/Utils/ClashMetaConf.php
cp template.yaml      $SSPANEL/config/clash-meta-template.yaml
```

### 第 2 步：修改 LinkController.php

在 `src/Controllers/LinkController.php` 做以下两处改动：

#### 改动 A — `use` 声明区加入 `ClashMetaConf`

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

#### 改动 B — `GetContent()` 中 `$opts = $request->getQueryParams();` 之后加一行

```php
$opts = $request->getQueryParams();
$opts['_ua'] = $request->getHeaderLine('User-Agent'); // ← 新增
```

#### 改动 C — `getClash()` 末尾替换返回值

将原来的 `return ConfController::getClashConfs(...)` 替换为：

```php
// --- Mihomo 客户端：下发独立模板配置 ---
if (self::isMihomoClient($opts['_ua'] ?? '')) {
    $metaYaml = ClashMetaConf::render($user, $Proxys);
    if ($metaYaml !== '') {
        return $metaYaml;
    }
}

return ConfController::getClashConfs($user, $Proxys, $_ENV['Clash_Profiles'][$Profiles]);
```

#### 改动 D — 在 `getClash()` 闭合括号后新增客户端检测方法

```php
/**
 * 检测是否是支持 nameserver-policy 的 Mihomo/Clash.Meta 核心客户端。
 *
 * 匹配的 User-Agent 关键词（大小写不敏感）：
 *   clash.meta   → Mihomo / Clash.Meta 官方核心
 *   mihomo       → Mihomo 新命名
 *   flclash      → FlClash 原版 + 定制版
 *   clash-verge  → Clash Verge / Clash Verge Rev
 *   clashx.meta  → ClashX.Meta（macOS）
 *
 * 不在列表中的客户端（下发面板默认配置）：
 *   Clash for Windows、ClashX（非 Meta 版）、Stash、OpenClash 等
 */
private static function isMihomoClient(string $ua): bool
{
    $ua = strtolower($ua);
    $patterns = ['clash.meta', 'mihomo', 'flclash', 'clash-verge', 'clashx.meta'];
    foreach ($patterns as $pattern) {
        if (strpos($ua, $pattern) !== false) {
            return true;
        }
    }
    return false;
}
```

### 第 3 步：编辑模板

打开 `$SSPANEL/config/clash-meta-template.yaml`，按注释修改 DNS 配置：

```
修改位置速查：

  nameserver（第 56 行）  → 主 DNS 服务器（境外 DoH）
  fallback  （第 70 行）  → Fallback DNS
  nameserver-policy（第 94 行）→ 按域名/geosite 指定 DNS ← 最常改这里
  proxy-groups（第 135 行）→ 代理组策略、地区分组
  rules     （第 169 行）→ 分流规则
```

修改保存后客户端重新拉取订阅即生效，无需重启任何服务。

---

## 模板机制

### `proxies: []`

`proxies:` 的值由 SSPanel 自动注入为当前用户的全部节点，保留该 key 即可。

### `__ALL__` 占位符

在 `proxy-groups` 的 `proxies` 列表中写 `__ALL__`，会被自动展开为所有节点名称：

```yaml
proxy-groups:
  - name: "🚀 节点选择"
    type: select
    proxies:
      - "♻️ 自动选择"
      - __ALL__          # 展开后：节点A、节点B、节点C...
```

可以在 `__ALL__` 前后添加固定条目（其他组名、`DIRECT` 等）。

### `filter` 按关键词筛选节点

Mihomo 支持用 `filter` 字段从 `__ALL__` 中筛选符合条件的节点，适合建立地区分组：

```yaml
  - name: "🇭🇰 香港节点"
    type: url-test
    proxies:
      - __ALL__
    filter: "香港|HK|Hong Kong"
    url: https://www.gstatic.com/generate_204
    interval: 300
```

---

## 支持的客户端

| 客户端 | User-Agent 特征 | 收到的配置 |
|--------|----------------|-----------|
| FlClash（原版 + 定制版）| `flclash` | ✅ 本模板 |
| Mihomo / Clash.Meta | `clash.meta` 或 `mihomo` | ✅ 本模板 |
| Clash Verge / Clash Verge Rev | `clash-verge` | ✅ 本模板 |
| ClashX.Meta（macOS）| `clashx.meta` | ✅ 本模板 |
| Clash for Windows | 无以上特征 | 面板默认配置 |
| ClashX（非 Meta 版）| 无以上特征 | 面板默认配置 |
| Stash、OpenClash 等 | 无以上特征 | 面板默认配置 |

---

## 验证方法

```bash
SSPANEL_URL=https://你的订阅域名
TOKEN=你的订阅Token

# Mihomo 客户端 — 应返回模板中的配置（含 fake-ip-range、nameserver-policy）
curl -s -A "clash.meta/1.18.0" "$SSPANEL_URL/link/$TOKEN?clash=1" \
  | grep -E "fake-ip-range|nameserver-policy|geosite"

# 确认 #!MANAGED-CONFIG 注释头存在（Clash Verge 托管配置依赖此标志）
curl -s -A "clash.meta/1.18.0" "$SSPANEL_URL/link/$TOKEN?clash=1" | head -3

# 普通 Clash 客户端 — 应返回面板默认配置，不含 nameserver-policy
curl -s -A "ClashForWindows/0.20.0" "$SSPANEL_URL/link/$TOKEN?clash=1" \
  | grep "nameserver-policy"
# 期望：无输出
```

---

## 常见问题

**Q: 代理组里没有节点？**
A: 确认模板中存在 `proxies:` 这一 key（值可以是 `[]`），SSPanel 通过该 key 注入节点。

**Q: `__ALL__` 未展开？**
A: 确认 `ClashMetaConf.php` 已部署到 `src/Utils/`，且 `use ... ClashMetaConf` 已加入 `LinkController.php`。

**Q: Clash Verge 提示不是托管配置？**
A: 确认 `.env` 中 `APP_URL`（或 `baseUrl`）配置正确，`render()` 用它构建 `#!MANAGED-CONFIG` URL。

**Q: 想给地区单独建组？**
A: 在 `proxy-groups` 中添加带 `filter` 的 `url-test` 组，然后在「节点选择」的 `proxies` 中引用该组名。

**Q: 想临时停用本方案，让所有客户端收到面板默认配置？**
A: 删除或重命名 `config/clash-meta-template.yaml`，`ClashMetaConf::render()` 返回空字符串后自动回落到面板默认配置。
