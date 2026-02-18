# SSPanel 域名替换补丁 + JA3 Guard 纯反代配置

## 功能说明

通过 **JA3 Guard** 在 TLS 层验证客户端指纹，只有受信任的客户端才会收到替换后的域名。
未匹配 JA3 指纹的请求返回原始域名。

支持协议：vmess / ss / ssr / trojan / vless / hysteria2 / hy2

---

## 请求链路

```
用户浏览器 → JA3 Guard (:443, TLS 指纹提取)
                 ↓
          业务服务器 Nginx (:80, HTTP)
                 ↓
          PHP-FPM → SSPanel LinkController
                 ↓
          检查 X-Guard-Secret + X-JA3-Trusted
                 ├── 受信任 → 返回替换后的域名
                 └── 不信任 → 返回原始域名
```

JA3 Guard 注入的 Header:

| Header | 值 | 说明 |
|--------|---|------|
| `X-Forwarded-Proto` | `https` | 原始协议 |
| `X-Real-IP` | 客户端 IP | 用户真实 IP |
| `X-Forwarded-Host` | 原始域名 | 用户访问的域名 |
| `X-JA3-Trusted` | `1` 或 `0` | TLS 指纹是否在白名单 |
| `X-JA3-Hash` | JA3 哈希值 | 客户端 TLS 指纹 |
| `X-Guard-Secret` | 密钥 | 验证请求来源 |

---

## 文件清单

| 文件 | 部署到业务服务器 | 说明 |
|------|-----------------|------|
| **domainReplace.php** | `config/domainReplace.php` | 配置：guard_secret + 域名映射 |
| **DomainReplacer.php** | `src/Utils/DomainReplacer.php` | 域名替换引擎 |
| **LinkController.php** | `src/Controllers/LinkController.php` | 已改好的控制器（含 JA3 验证） |
| **nginx-vhost.conf** | `/www/server/nginx/conf/vhost/sspanel.conf` | Nginx 虚拟主机配置（宝塔），含 HTTPS 代理信任 |

---

## 部署步骤

### 第 1 步：配置 Nginx

将 `nginx-vhost.conf` 复制到业务服务器（宝塔环境）：

```bash
scp nginx-vhost.conf root@业务服务器:/www/server/nginx/conf/vhost/sspanel.conf
```

**必须修改的内容：**
- `server_name` → 你的订阅域名
- `root` → SSPanel 的 `public` 目录路径
- `set_real_ip_from` → JA3 Guard 服务器 IP

```bash
# 测试配置、重载
/www/server/nginx/sbin/nginx -t && /www/server/nginx/sbin/nginx -s reload
```

> 宝塔面板会自动加载 `/www/server/nginx/conf/vhost/` 下的 `.conf` 文件，无需手动创建软链接。

> Nginx 配置中已包含 `fastcgi_param HTTPS on;`，使 PHP 正确识别 HTTPS 协议（替代 Laravel TrustProxies 中间件），同时 `set_real_ip_from` 负责还原客户端真实 IP。

### 第 2 步：部署 PHP 补丁

```bash
# SSPanel 根目录示例：/www/wwwroot/www.gkdyyds.top
cp DomainReplacer.php   /www/wwwroot/www.gkdyyds.top/src/Utils/DomainReplacer.php
cp domainReplace.php    /www/wwwroot/www.gkdyyds.top/config/domainReplace.php
cp LinkController.php   /www/wwwroot/www.gkdyyds.top/src/Controllers/LinkController.php
```

> 如果你的 `LinkController.php` 有其他自定义修改，见下方「手动改法」。

### 第 3 步：填入 guard_secret

编辑 `config/domainReplace.php`：

```php
return [
    'enabled' => true,
    'guard_secret' => '你的guard_secret',   // ← 必须与 JA3 Guard config.json 中的值一致
    'mapping' => [
        '*.gnodecn.com' => '*.gkdnode.net',  // 泛域名匹配
        // 也支持精确匹配（优先级更高）:
        // 'hk1.gnodecn.com' => 'special.gkdnode.net',
    ],
];
```

### 第 4 步：防火墙（推荐）

限制只有 JA3 Guard 能访问业务服务器的 80 端口：

```bash
# UFW
ufw allow from JA3_GUARD_IP to any port 80
ufw deny 80

# 或 iptables
iptables -A INPUT -p tcp --dport 80 -s JA3_GUARD_IP -j ACCEPT
iptables -A INPUT -p tcp --dport 80 -j DROP
```

---

## 手动改法（不想覆盖 LinkController）

如果你的 `LinkController.php` 有其他自定义修改：

**第一步：文件顶部 use 声明区，加一行 `DomainReplacer`**

```php
use App\Utils\{
    URL,
    Tools,
    AppURI,
    ConfRender,
    DomainReplacer    // ← 新增
};
```

**第二步：`GetContent()` 中 `$content = self::$class(...)` 之后、`$getBody = self::getBody(` 之前插入**

```php
$content = self::$class($user, $query_value, $opts, $Rule);

// --- JA3 Guard 域名替换 开始 ---
$replaceConfig = require BASE_PATH . '/config/domainReplace.php';
if (
    $replaceConfig['enabled']
    && !empty($replaceConfig['mapping'])
) {
    $guardSecret = $replaceConfig['guard_secret'] ?? '';
    $reqSecret = $request->getHeaderLine('X-Guard-Secret');
    $isTrusted = $request->getHeaderLine('X-JA3-Trusted') === '1';

    if ($guardSecret !== '' && hash_equals($guardSecret, $reqSecret) && $isTrusted) {
        $replacer = new DomainReplacer($replaceConfig['mapping']);
        $content = $replacer->replaceBase64($content);
    }
}
// --- JA3 Guard 域名替换 结束 ---

$getBody = self::getBody(
```

---

## 配置说明

`config/domainReplace.php` 配置项：

| 配置项 | 说明 |
|--------|------|
| `enabled` | `true` 启用 / `false` 关闭 |
| `guard_secret` | 与 JA3 Guard 的共享密钥，必须一致 |
| `mapping` | 域名映射表，支持精确匹配和泛域名 |

**映射规则：**
- `'hk1.old.com' => 'hk1.new.com'` — 精确匹配（优先级高）
- `'*.old.com' => '*.new.com'` — 泛域名（自动保留子域名：`hk1.old.com` → `hk1.new.com`）

---

## 验证方法

### 测试上游连通性

从 JA3 Guard 服务器：
```bash
curl -H "Host: sub.example.com" http://业务服务器IP:80/
```
应返回 SSPanel 页面（非 Nginx 默认页或 404）。

### 测试 Header 传递

在 SSPanel 的 `app/routes.php` 中临时添加测试路由：
```php
$app->get('/ja3test', function ($request, $response) {
    return $response->withJson([
        'ip'       => $_SERVER['REMOTE_ADDR'],
        'https'    => $_SERVER['HTTPS'] ?? 'off',
        'proto'    => $request->getHeaderLine('X-Forwarded-Proto'),
        'host'     => $request->getHeaderLine('X-Forwarded-Host'),
        'trusted'  => $request->getHeaderLine('X-JA3-Trusted'),
        'secret'   => $request->getHeaderLine('X-Guard-Secret') ? 'present' : 'missing',
    ]);
});
```

通过 JA3 Guard 域名访问 `https://sub.example.com/ja3test`，确认：
- `ip` → 你的客户端真实 IP
- `https` → `on`
- `proto` → `https`
- `trusted` → `1` 或 `0`
- `secret` → `present`

### 测试域名替换

1. 用 **Shadowrocket** 拉取订阅 → 节点域名已替换（JA3 受信任时）
2. 用 **浏览器** 访问同一链接 → 域名未替换（浏览器 JA3 不在白名单）

---

## 常见问题

**Q: 订阅返回 404？**
A: 检查 Nginx `server_name` 是否与订阅域名一致，`root` 指向 SSPanel 的 `public` 目录。

**Q: 订阅返回空白？**
A: 检查 PHP-FPM 是否运行、查看日志（`storage/logs/`）。

**Q: HTTPS 重定向循环？**
A: 检查 Nginx 配置中是否包含 `fastcgi_param HTTPS on;`，确保 PHP 能识别原始 HTTPS 协议。

**Q: 替换不生效？**
A: 依次检查：
  1. `domainReplace.php` 中 `enabled` 是否为 `true`
  2. `guard_secret` 是否与 JA3 Guard 一致
  3. mapping 中的旧域名是否与订阅中的节点域名完全一致
  4. 客户端的 JA3 指纹是否已加入白名单

**Q: 想对所有受信任客户端都替换（不限 Shadowrocket）？**
A: 当前版本已经是这样 — 只要 JA3 指纹在白名单就替换，不区分客户端类型。

**Q: `BASE_PATH` 未定义？**
A: SSPanel 默认在入口文件定义了 `BASE_PATH`。如果你的版本没有，可替换为绝对路径。
