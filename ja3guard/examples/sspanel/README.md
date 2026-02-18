# JA3 Guard 纯反代模式 — 业务服务器配置指南

当 JA3 Guard 以**纯反代模式**运行（业务后端在远程服务器），需要在业务服务器上完成以下配置。

## 请求链路

```
用户浏览器 → JA3 Guard (:443, TLS) → 业务服务器 Nginx (:80, HTTP) → PHP-FPM → SSPanel
```

JA3 Guard 发送到上游的 Header:

| Header | 值 | 说明 |
|--------|---|------|
| `X-Forwarded-Proto` | `https` | 原始协议 |
| `X-Real-IP` | 客户端 IP | 用户真实 IP |
| `X-Forwarded-Host` | 原始域名 | 用户访问的域名 |
| `X-JA3-Trusted` | `1` 或 `0` | TLS 指纹是否在白名单 |
| `X-JA3-Hash` | JA3 哈希值 | 客户端 TLS 指纹 |
| `X-Guard-Secret` | 密钥 | 用于验证请求来源 |

---

## 配置步骤

### 第 1 步: Nginx 虚拟主机

将 `nginx-vhost.conf` 复制到业务服务器并修改:

```bash
# 复制配置
scp nginx-vhost.conf root@业务服务器:/etc/nginx/sites-available/sspanel.conf

# SSH 到业务服务器
ssh root@业务服务器

# 修改配置（替换域名、IP、路径）
nano /etc/nginx/sites-available/sspanel.conf

# 启用站点
ln -sf /etc/nginx/sites-available/sspanel.conf /etc/nginx/sites-enabled/

# 删除默认站点（可选）
rm -f /etc/nginx/sites-enabled/default

# 测试 & 重载
nginx -t && systemctl reload nginx
```

**必须修改的内容:**
- `server_name` → 你的订阅域名
- `root` → SSPanel 的 `public` 目录
- `set_real_ip_from` → JA3 Guard 服务器 IP
- `fastcgi_pass` → 你的 PHP-FPM socket 路径

### 第 2 步: Laravel TrustProxies

将 `TrustProxies.php` 覆盖到 SSPanel 项目:

```bash
cp TrustProxies.php /www/sspanel/app/Http/Middleware/TrustProxies.php
```

这使得 Laravel 正确识别:
- `request()->secure()` 返回 `true`（而非 `false`）
- `request()->ip()` 返回客户端真实 IP（而非 JA3 Guard IP）
- `url()` 生成 `https://` 链接（而非 `http://`）

### 第 3 步: Guard Secret 验证（可选但推荐）

将 `JA3GuardMiddleware.php` 复制到 SSPanel 项目:

```bash
cp JA3GuardMiddleware.php /www/sspanel/app/Http/Middleware/JA3GuardMiddleware.php
```

在 `.env` 中添加:

```
JA3_GUARD_SECRET=你在JA3Guard中配置的guard_secret
```

注册中间件到 `app/Http/Kernel.php`:

```php
protected $middleware = [
    // ... 其他中间件
    \App\Http\Middleware\JA3GuardMiddleware::class,
];
```

### 第 4 步: 防火墙（推荐）

限制只有 JA3 Guard 服务器能访问业务服务器的 80 端口:

```bash
# UFW
ufw allow from JA3_GUARD_IP to any port 80
ufw deny 80

# 或 iptables
iptables -A INPUT -p tcp --dport 80 -s JA3_GUARD_IP -j ACCEPT
iptables -A INPUT -p tcp --dport 80 -j DROP
```

---

## 验证配置

### 测试连通性

从 JA3 Guard 服务器测试上游是否可达:

```bash
curl -H "Host: sub.example.com" http://业务服务器IP:80/
```

应返回 SSPanel 页面（而非 Nginx 默认页或 404）。

### 检查 Header 传递

在 SSPanel 中临时添加测试路由:

```php
// routes/web.php
Route::get('/ja3test', function () {
    return response()->json([
        'ip'       => request()->ip(),
        'secure'   => request()->secure(),
        'proto'    => request()->header('X-Forwarded-Proto'),
        'host'     => request()->header('X-Forwarded-Host'),
        'trusted'  => request()->header('X-JA3-Trusted'),
    ]);
});
```

然后通过 JA3 Guard 域名访问 `https://sub.example.com/ja3test`，确认:
- `ip` → 你的客户端真实 IP
- `secure` → `true`
- `proto` → `https`
- `host` → `sub.example.com`
- `trusted` → `1` 或 `0`

---

## 常见问题

### 订阅返回 404

1. 检查 Nginx `server_name` 是否与订阅域名一致
2. 检查 Nginx `root` 路径是否指向 SSPanel 的 `public` 目录
3. 确认 `try_files` 包含 `/index.php?$query_string`

### 订阅返回空白

1. 检查 PHP-FPM 是否运行: `systemctl status php8.1-fpm`
2. 查看 PHP 错误日志: `tail -f /var/log/php8.1-fpm.log`
3. 查看 Laravel 日志: `tail -f /www/sspanel/storage/logs/laravel.log`

### HTTPS 重定向循环

**原因:** Laravel 检测到请求是 HTTP，自动重定向到 HTTPS，形成死循环。
**解决:** 确认 `TrustProxies.php` 已正确配置，使 `request()->secure()` 返回 `true`。

### 订阅链接使用 http:// 前缀

**原因:** 同上，Laravel 未识别到 HTTPS 协议。
**解决:** 确认 `TrustProxies.php` 已正确配置。
