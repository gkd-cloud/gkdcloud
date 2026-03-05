# SSPanel 补丁集

本目录包含对 SSPanel-Metron 的所有补丁文件，按功能独立维护，可按需叠加部署。

---

## 功能模块

| 模块 | 说明 |
|------|------|
| **JA3 Guard 域名替换** | 通过 TLS 指纹白名单，对受信任客户端替换节点域名 |
| **Clash 客户端 DNS 增强** | 自动识别 Mihomo 核心客户端，下发含 `nameserver-policy` 的增强 DNS 配置 |

---

## 文件清单

| 文件 | 部署到业务服务器 | 说明 |
|------|-----------------|------|
| **domainReplace.php** | `config/domainReplace.php` | JA3 Guard 配置：guard_secret + 域名映射 |
| **DomainReplacer.php** | `src/Utils/DomainReplacer.php` | 域名替换引擎 |
| **clashMetaDns.php** | `config/clashMetaDns.php` | Mihomo 客户端 DNS 配置（nameserver-policy） |
| **LinkController.php** | `src/Controllers/LinkController.php` | 包含全部补丁的控制器（JA3 验证 + Clash DNS 增强） |
| **nginx-vhost.conf** | `/www/server/nginx/conf/vhost/sspanel.conf` | Nginx 虚拟主机配置（宝塔），含 HTTPS 代理信任 |

---

## 模块一：JA3 Guard 域名替换

### 请求链路

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

### 部署步骤

**第 1 步：配置 Nginx**

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

> Nginx 配置中已包含 `fastcgi_param HTTPS on;`，使 PHP 正确识别 HTTPS 协议，同时 `set_real_ip_from` 负责还原客户端真实 IP。

**第 2 步：部署 PHP 补丁**

```bash
# SSPanel 根目录示例：/www/wwwroot/www.example.com
SSPANEL=/www/wwwroot/www.example.com

cp DomainReplacer.php   $SSPANEL/src/Utils/DomainReplacer.php
cp domainReplace.php    $SSPANEL/config/domainReplace.php
cp clashMetaDns.php     $SSPANEL/config/clashMetaDns.php
cp LinkController.php   $SSPANEL/src/Controllers/LinkController.php
```

**第 3 步：填入 guard_secret**

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

**第 4 步：防火墙（推荐）**

限制只有 JA3 Guard 能访问业务服务器的 80 端口：

```bash
# UFW
ufw allow from JA3_GUARD_IP to any port 80
ufw deny 80

# 或 iptables
iptables -A INPUT -p tcp --dport 80 -s JA3_GUARD_IP -j ACCEPT
iptables -A INPUT -p tcp --dport 80 -j DROP
```

### 手动改法（不想覆盖 LinkController）

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

**第二步：`GetContent()` 中 `$opts = $request->getQueryParams();` 之后加一行**

```php
$opts = $request->getQueryParams();
$opts['_ua'] = $request->getHeaderLine('User-Agent'); // ← 新增
```

**第三步：`$content = self::$class(...)` 之后、`$getBody = self::getBody(` 之前插入**

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

## 模块二：Clash 客户端 DNS 增强

### 功能说明

SSPanel 默认对所有 Clash 客户端下发相同的 YAML 配置。
**Mihomo 核心客户端**（FlClash、Clash Verge 等）支持 `nameserver-policy`（按域名指定 DNS 服务器），
而普通 Clash 客户端（Clash for Windows 等）不支持，强行下发会报错。

本模块通过解析 HTTP `User-Agent` 自动识别客户端，只对 Mihomo 核心客户端注入增强 DNS 配置。

### 支持的客户端

| 客户端 | User-Agent 特征 | 是否收到增强配置 |
|--------|----------------|----------------|
| FlClash（原版 + 定制版） | `flclash` | ✅ 注入 nameserver-policy |
| Mihomo / Clash.Meta | `clash.meta` 或 `mihomo` | ✅ 注入 nameserver-policy |
| Clash Verge / Clash Verge Rev | `clash-verge` | ✅ 注入 nameserver-policy |
| ClashX.Meta（macOS） | `clashx.meta` | ✅ 注入 nameserver-policy |
| Clash for Windows（CFW） | 无以上特征 | ❌ 原始默认配置 |
| ClashX（非 Meta 版） | 无以上特征 | ❌ 原始默认配置 |
| Stash、OpenClash 等 | 无以上特征 | ❌ 原始默认配置 |

### 部署步骤

**第 1 步：复制配置文件**

```bash
SSPANEL=/www/wwwroot/www.example.com

cp clashMetaDns.php  $SSPANEL/config/clashMetaDns.php
cp LinkController.php $SSPANEL/src/Controllers/LinkController.php
```

**第 2 步：自定义 DNS 配置**

编辑 `$SSPANEL/config/clashMetaDns.php`，按注释修改：

```
修改位置速查：
  第 36 行：nameserver      → 主 DNS 服务器（境外 DoH）
  第 49 行：fallback        → Fallback DNS
  第 57 行：fallback-filter → 触发 fallback 的条件（默认：返回国内 IP 时触发）
  第 79 行：nameserver-policy → 核心：按域名指定 DNS（geosite:cn 国内域名走国内 DNS）
```

修改完成后，客户端重新拉取订阅即生效，无需重启 PHP-FPM。

### DNS 配置说明

`config/clashMetaDns.php` 返回一个 PHP 数组，内容对应 Clash YAML 的 `dns:` 节：

```yaml
dns:
  nameserver:            # ← 对应 'nameserver' 键
    - https://1.1.1.1/dns-query
  fallback:              # ← 对应 'fallback' 键
    - 114.114.114.114
  fallback-filter:       # ← 对应 'fallback-filter' 键
    geoip: true
    geoip-code: CN
  nameserver-policy:     # ← 对应 'nameserver-policy' 键（核心）
    geosite:cn:
      - 223.5.5.5
      - 119.29.29.29
    geosite:private:
      - system
```

**注意事项：**
- 本模块只修改 Clash YAML 的 `dns:` 节，不影响 `proxies:`、`proxy-groups:`、`rules:` 等其他部分
- 配置文件中的键会**覆盖**面板模板中已有的同名 DNS 字段
- 删除或清空 `config/clashMetaDns.php` 会使本模块静默失效（所有客户端收到默认配置），不报错

### 手动改法（不想覆盖 LinkController）

如果你的 `LinkController.php` 有其他自定义修改，手动添加以下 3 处改动：

**第一步：`GetContent()` 中 `$opts = $request->getQueryParams();` 之后加一行**

```php
$opts = $request->getQueryParams();
$opts['_ua'] = $request->getHeaderLine('User-Agent'); // ← 新增
```

**第二步：`getClash()` 方法末尾，将 `return` 改为先存变量再注入**

将原来的：
```php
return ConfController::getClashConfs($user, $Proxys, $_ENV['Clash_Profiles'][$Profiles]);
```
替换为：
```php
$yaml = ConfController::getClashConfs($user, $Proxys, $_ENV['Clash_Profiles'][$Profiles]);

// --- Mihomo 客户端 DNS 增强 开始 ---
if (self::isMihomoClient($opts['_ua'] ?? '')) {
    $yaml = self::injectMihomoConfig($yaml);
}
// --- Mihomo 客户端 DNS 增强 结束 ---

return $yaml;
```

**第三步：在 `getClash()` 闭合括号后添加两个私有静态方法**

```php
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

private static function injectMihomoConfig(string $yaml): string
{
    $dnsConfigPath = BASE_PATH . '/config/clashMetaDns.php';
    if (!file_exists($dnsConfigPath)) {
        return $yaml;
    }

    $dnsConfig = require $dnsConfigPath;
    if (empty($dnsConfig) || !is_array($dnsConfig)) {
        return $yaml;
    }

    $dnsBlockPattern = '/^dns:\s*\n(?:[ \t]+[^\n]*\n?)*/m';

    if (!preg_match($dnsBlockPattern, $yaml)) {
        $newDns = array_merge(['enable' => true], $dnsConfig);
        $newDnsBlock = \Symfony\Component\Yaml\Yaml::dump(['dns' => $newDns], 4, 2);
        return preg_replace('/^(rules:|Rule:)/m', $newDnsBlock . "\n$1", $yaml, 1);
    }

    $existingDns = [];
    try {
        preg_match($dnsBlockPattern, $yaml, $matches);
        $dnsBody = preg_replace('/^dns:\s*\n/', '', $matches[0]);
        $parsed  = \Symfony\Component\Yaml\Yaml::parse("_:\n" . $dnsBody);
        $existingDns = is_array($parsed['_'] ?? null) ? $parsed['_'] : [];
    } catch (\Exception $e) {
        // 解析失败以空数组为基础
    }

    $mergedDns   = array_merge($existingDns, $dnsConfig);
    $newDnsBlock = \Symfony\Component\Yaml\Yaml::dump(['dns' => $mergedDns], 4, 2);

    return preg_replace($dnsBlockPattern, $newDnsBlock . "\n", $yaml, 1);
}
```

---

## 验证方法

### JA3 Guard 域名替换

**测试上游连通性**（从 JA3 Guard 服务器）：
```bash
curl -H "Host: sub.example.com" http://业务服务器IP:80/
```
应返回 SSPanel 页面（非 Nginx 默认页或 404）。

**测试 Header 传递**（在 `app/routes.php` 临时添加）：
```php
$app->get('/ja3test', function ($request, $response) {
    return $response->withJson([
        'ip'      => $_SERVER['REMOTE_ADDR'],
        'https'   => $_SERVER['HTTPS'] ?? 'off',
        'trusted' => $request->getHeaderLine('X-JA3-Trusted'),
        'secret'  => $request->getHeaderLine('X-Guard-Secret') ? 'present' : 'missing',
    ]);
});
```

**测试域名替换**：
1. 用 **FlClash / Shadowrocket** 拉取订阅 → 节点域名已替换（JA3 受信任时）
2. 用 **浏览器** 访问同一链接 → 域名未替换（浏览器 JA3 不在白名单）

### Clash DNS 增强

```bash
SSPANEL_URL=https://你的订阅域名
TOKEN=你的订阅Token

# Mihomo 客户端（应包含 nameserver-policy）
curl -s -A "clash.meta/1.18.0" "$SSPANEL_URL/link/$TOKEN?clash=1" | grep -A 10 "nameserver-policy"

# 普通 Clash（应无 nameserver-policy）
curl -s -A "ClashForWindows/0.20.0" "$SSPANEL_URL/link/$TOKEN?clash=1" | grep "nameserver-policy"
# 期望：无输出

# 降级验证（配置文件不存在时订阅应正常返回）
mv $SSPANEL/config/clashMetaDns.php /tmp/clashMetaDns.php.bak
curl -s -A "clash.meta/1.18.0" "$SSPANEL_URL/link/$TOKEN?clash=1" | head -5
# 期望：正常返回 YAML，无报错
mv /tmp/clashMetaDns.php.bak $SSPANEL/config/clashMetaDns.php
```

---

## 常见问题

**Q: 订阅返回 404？**
A: 检查 Nginx `server_name` 是否与订阅域名一致，`root` 指向 SSPanel 的 `public` 目录。

**Q: 订阅返回空白？**
A: 检查 PHP-FPM 是否运行、查看日志（`storage/logs/`）。

**Q: HTTPS 重定向循环？**
A: 检查 Nginx 配置中是否包含 `fastcgi_param HTTPS on;`。

**Q: JA3 域名替换不生效？**
A: 依次检查：
  1. `domainReplace.php` 中 `enabled` 是否为 `true`
  2. `guard_secret` 是否与 JA3 Guard 一致
  3. `mapping` 中的旧域名是否与订阅中的节点域名完全一致
  4. 客户端的 JA3 指纹是否已加入白名单

**Q: Mihomo 客户端没有收到 nameserver-policy？**
A: 依次检查：
  1. `config/clashMetaDns.php` 是否已复制到 SSPanel 根目录下的 `config/` 目录
  2. 文件内容是否为有效的 PHP 数组（语法错误会导致静默失败）
  3. 用 `curl -s -A "clash.meta/1.0" "订阅链接"` 手动测试，确认 UA 能被识别
  4. 检查面板的 Clash 模板是否包含 `dns:` 节（若无则会自动插入）

**Q: 想新增一个 Mihomo 客户端到识别列表？**
A: 编辑 `LinkController.php`，找到 `isMihomoClient()` 方法，在 `$patterns` 数组中添加对应的 User-Agent 关键词（小写）。

**Q: `BASE_PATH` 未定义？**
A: SSPanel 默认在入口文件定义了 `BASE_PATH`。如果你的版本没有，可替换为绝对路径。
