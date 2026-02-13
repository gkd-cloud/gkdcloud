# SSPanel-UIM Shadowrocket 域名替换补丁

## 功能说明

当 **Shadowrocket** 客户端请求订阅链接时，自动将节点中的连接域名替换为指定域名。
其他客户端（Clash、Surge、浏览器等）不受影响，原样返回。

支持协议：vmess / ss / trojan / vless / hysteria2 / hy2

---

## 文件清单

本补丁需要操作 **3 个文件**：

| 操作 | 文件路径 | 说明 |
|------|---------|------|
| **新增** | `src/Utils/DomainReplacer.php` | 域名替换工具类 |
| **新增** | `config/domainReplace.php` | 域名映射配置 |
| **修改** | `src/Controllers/LinkController.php` | 在返回订阅前插入替换逻辑（约改 5 行） |

---

## 步骤一：添加工具类

把 `DomainReplacer.php` 复制到 SSPanel 项目的 `src/Utils/` 目录：

```bash
cp DomainReplacer.php /你的sspanel路径/src/Utils/DomainReplacer.php
```

无需修改任何内容，直接放入即可。

---

## 步骤二：添加配置文件

把 `domainReplace.php` 复制到 SSPanel 项目的 `config/` 目录：

```bash
cp domainReplace.php /你的sspanel路径/config/domainReplace.php
```

然后编辑它，填入你的实际域名映射：

```php
return [
    'enabled' => true,
    'mapping' => [
        'hk1.old-domain.com' => 'hk1.new-domain.com',
        'us1.old-domain.com' => 'us1.new-domain.com',
        // 按需添加更多...
    ],
];
```

**规则说明**：
- 左边是订阅里原本的节点域名（旧域名）
- 右边是你想替换成的域名（新域名）
- 必须精确匹配，不支持通配符
- `enabled` 设为 `false` 可一键关闭替换功能

---

## 步骤三：修改 LinkController.php

打开 `src/Controllers/LinkController.php`，做两处改动。

### 3.1 文件顶部添加 use 语句

在文件顶部的 `use` 声明区域，添加一行：

```php
use App\Utils\DomainReplacer;
```

**示例**（找到类似这样的位置）：

```php
use App\Utils\Tools;
use App\Utils\DomainReplacer;  // ← 加这一行
```

### 3.2 找到返回订阅内容的位置，插入替换逻辑

在 `LinkController.php` 中搜索实际返回订阅内容的地方。
通常是一个 `return` 语句，把 Base64 编码后的内容写入 Response Body。

常见的写法类似：

```php
// 原代码（可能长这样，具体以你的版本为准）
$body = $response->getBody();
$body->write($content);    // $content 是 base64 编码的订阅
return $response;
```

**在 `$body->write(...)` 之前**，插入以下代码：

```php
// --- Shadowrocket 域名替换 开始 ---
$ua = $request->getHeaderLine('User-Agent');
$replaceConfig = require BASE_PATH . '/config/domainReplace.php';
if ($replaceConfig['enabled']
    && DomainReplacer::isShadowrocket($ua)
    && !empty($replaceConfig['mapping'])
) {
    $replacer = new DomainReplacer($replaceConfig['mapping']);
    $content = $replacer->replaceBase64($content);
}
// --- Shadowrocket 域名替换 结束 ---
```

插入后整体效果：

```php
// ... 上面是生成 $content 的逻辑 ...

// --- Shadowrocket 域名替换 开始 ---
$ua = $request->getHeaderLine('User-Agent');
$replaceConfig = require BASE_PATH . '/config/domainReplace.php';
if ($replaceConfig['enabled']
    && DomainReplacer::isShadowrocket($ua)
    && !empty($replaceConfig['mapping'])
) {
    $replacer = new DomainReplacer($replaceConfig['mapping']);
    $content = $replacer->replaceBase64($content);
}
// --- Shadowrocket 域名替换 结束 ---

$body = $response->getBody();
$body->write($content);
return $response;
```

> **提示**：如果你的 SSPanel 版本中变量名不叫 `$content`，请替换为实际的变量名（就是那个存放 base64 订阅字符串的变量）。

---

## 如何确认生效

1. 用 Shadowrocket 拉取订阅，检查节点列表中的域名是否已替换
2. 用 Clash 或浏览器访问同一订阅链接，确认域名**未被替换**（原样返回）
3. 查看服务器日志确认无 PHP 报错

---

## 如何定位你的 LinkController 中的关键位置

如果你不确定在哪里插入代码，可以用以下方法定位：

```bash
# 在 SSPanel 根目录执行，搜索返回订阅内容的位置
grep -n 'write(' src/Controllers/LinkController.php
grep -n 'base64_encode' src/Controllers/LinkController.php
grep -n 'getBody' src/Controllers/LinkController.php
```

找到类似 `$body->write(...)` 或 `return $response->write(...)` 的行，在它前面插入替换逻辑。

---

## 常见问题

**Q: 替换不生效？**
A: 确认 `config/domainReplace.php` 中 `enabled` 为 `true`，且 `mapping` 里的旧域名与订阅中的节点域名完全一致（区分大小写）。

**Q: 所有客户端都被替换了？**
A: 检查 `isShadowrocket()` 判断是否正确。正常情况只有 UA 包含 "Shadowrocket" 时才触发。

**Q: 想对其他客户端也替换？**
A: 修改 `DomainReplacer::isShadowrocket()` 方法，或者去掉 `LinkController.php` 中的 UA 判断条件。

**Q: `BASE_PATH` 未定义？**
A: SSPanel-UIM 默认在入口文件定义了 `BASE_PATH`。如果你的版本没有，替换为 `__DIR__ . '/../../config/domainReplace.php'`（按实际路径调整）。
