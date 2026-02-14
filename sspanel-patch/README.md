# SSPanel Shadowrocket 域名替换补丁

## 功能说明

当 **Shadowrocket (iOS)** 客户端请求订阅链接时，自动将节点中的连接域名替换为指定域名。
其他客户端（Clash、Surge、浏览器等）不受影响，原样返回。

支持协议：vmess / ss / trojan / vless / hysteria2 / hy2

---

## 文件清单

本补丁涉及 **3 个文件**：

| 操作 | 放置路径（SSPanel 项目内） | 说明 |
|------|--------------------------|------|
| **新增** | `src/Utils/DomainReplacer.php` | 域名替换工具类 |
| **新增** | `config/domainReplace.php` | 域名映射配置 |
| **已改好** | `src/Controllers/LinkController.php` | 已插入替换逻辑，直接覆盖即可 |

---

## 部署方式

### 方法一：直接覆盖（推荐）

本目录下的 `LinkController.php` 已经改好，三个文件直接复制到 SSPanel 对应位置即可：

```bash
# 假设 SSPanel 根目录为 /www/sspanel
cp DomainReplacer.php   /www/sspanel/src/Utils/DomainReplacer.php
cp domainReplace.php    /www/sspanel/config/domainReplace.php
cp LinkController.php   /www/sspanel/src/Controllers/LinkController.php
```

然后编辑 `config/domainReplace.php`，填入你的实际域名映射（见下方配置说明）。

### 方法二：手动改自己的 LinkController

如果你的 `LinkController.php` 有其他自定义修改不想被覆盖，按以下两步手动改：

**第一步：文件顶部 use 声明区**

找到：
```php
use App\Utils\{
    URL,
    Tools,
    AppURI,
    ConfRender
};
```

改为（加一行 `DomainReplacer`）：
```php
use App\Utils\{
    URL,
    Tools,
    AppURI,
    ConfRender,
    DomainReplacer
};
```

**第二步：`GetContent()` 方法中，第 171-172 行之间**

找到：
```php
$content = self::$class($user, $query_value, $opts, $Rule);
$getBody = self::getBody(
```

改为：
```php
$content = self::$class($user, $query_value, $opts, $Rule);

// --- Shadowrocket iOS 域名替换 开始 ---
$ua = $request->getHeaderLine('User-Agent');
$replaceConfig = require BASE_PATH . '/config/domainReplace.php';
if (
    $replaceConfig['enabled']
    && DomainReplacer::isShadowrocket($ua)
    && !empty($replaceConfig['mapping'])
) {
    $replacer = new DomainReplacer($replaceConfig['mapping']);
    $content = $replacer->replaceBase64($content);
}
// --- Shadowrocket iOS 域名替换 结束 ---

$getBody = self::getBody(
```

---

## 配置说明

编辑 `config/domainReplace.php`：

```php
return [
    'enabled' => true,       // true 启用 / false 关闭
    'mapping' => [
        'hk1.old-domain.com' => 'hk1.new-domain.com',
        'us1.old-domain.com' => 'us1.new-domain.com',
        // 按需添加更多...
    ],
];
```

- **左边** = 订阅里原本的节点域名（旧域名）
- **右边** = 要替换成的域名（新域名）
- 精确匹配，区分大小写
- `enabled` 设为 `false` 一键关闭

---

## 工作原理

```
用户请求订阅
    ↓
GetContent() 根据参数生成 $content（base64 编码的节点列表）
    ↓
检测 User-Agent 是否包含 "Shadowrocket"
    ├── 否 → 原样返回
    └── 是 → 解码 base64 → 逐行替换节点域名 → 重新编码 → 返回
```

插入位置在 `LinkController.php` 的 `GetContent()` 方法中（第 174-185 行），
即 `$content` 生成之后、`getBody()` 写入响应之前。

---

## 验证方法

1. 用 **Shadowrocket** 拉取订阅 → 检查节点域名是否已替换
2. 用 **Clash / 浏览器** 访问同一链接 → 确认域名未被替换（原样）
3. 查看服务器日志确认无 PHP 报错

---

## 常见问题

**Q: 替换不生效？**
A: 确认 `config/domainReplace.php` 中 `enabled` 为 `true`，且 mapping 里的旧域名与订阅中的节点域名完全一致。

**Q: 想对所有客户端都替换？**
A: 去掉 `DomainReplacer::isShadowrocket($ua)` 这个条件判断即可。

**Q: `BASE_PATH` 未定义？**
A: SSPanel 默认在入口文件定义了 `BASE_PATH`。如果你的版本没有，可替换为绝对路径，如 `require '/www/sspanel/config/domainReplace.php'`。
