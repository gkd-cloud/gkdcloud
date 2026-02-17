# JA3 Guard

TLS 指纹验证反向代理，用于保护订阅接口隐藏域名不被 GFW 主动探测发现。

## 原理

JA3 是基于 TLS Client Hello 报文生成的客户端指纹（MD5 hash），由 TLS 版本、密码套件、扩展列表等参数决定。不同操作系统和应用的 TLS 栈产生不同的 JA3 指纹，且**无法通过简单的 header 伪造**来仿冒。

JA3 Guard 在 TLS 握手阶段截获原始 ClientHello 字节，计算 JA3 hash，对比白名单后决定是否向上游传递「可信」标记。不在白名单中的请求只能拿到正常域名，**永远接触不到隐藏域名**。

```
宁可错杀，不可放过 —— GFW 仅需成功一次，隐藏域名就会泄露
```

## 架构

```
                          订阅域名不走 CDN，DNS 直连
                                    │
  iOS Shadowrocket ───TLS───► JA3 Guard (Docker, :443)
                                    │
                              ┌─────┴──────┐
                              │ 截获        │
                              │ ClientHello │
                              │ 计算 JA3    │
                              │ 查白名单     │
                              └─────┬──────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │ Header 注入                     │
                    │ X-JA3-Trusted: 1 或 0          │
                    │ X-Guard-Secret: <共享密钥>      │
                    └───────────────┬───────────────┘
                                    │
                          Nginx (127.0.0.1:8080)
                                    │
                          PHP (SSPanel)
                                    │
                    ┌───────────────┴───────────────┐
                    │ 验证 X-Guard-Secret            │
                    │ X-JA3-Trusted = 1 → 隐藏域名   │
                    │ X-JA3-Trusted = 0 → 正常域名   │
                    └───────────────────────────────┘
```

### 三个监听端口

| 端口 | 协议 | 用途 |
|------|------|------|
| 80   | HTTP | Let's Encrypt ACME HTTP-01 验证 + HTTPS 重定向 |
| 443  | TLS  | 订阅代理（截获 ClientHello → 计算 JA3 → 反代到上游） |
| 8443 | HTTP | 管理面板（仅绑定 127.0.0.1，通过 SSH 隧道访问） |

## 安装

两种部署方式，选其一即可：

| 方式 | 适用场景 | 优势 |
|------|---------|------|
| **裸机部署** | 独立 VPS 只跑 JA3 Guard | 更轻量，无 Docker 开销，systemd 管理 |
| **Docker 部署** | 与其他服务共存，或偏好容器化 | 环境隔离，一条命令启停 |

### 前置条件

- 一个独立的订阅子域名（如 `sub.example.com`），DNS 直连到服务器，**不走 CDN**
- 服务器 80/443 端口可用（如果主站也在同一台服务器，见下方「同机部署」章节）

---

### 方式一：裸机一键部署（推荐用于独立 VPS）

支持 Debian 11/12、Ubuntu 20.04+、CentOS/RHEL 8+，x86_64 和 ARM64。

```bash
cd /opt
git clone <repo-url> gkdcloud
cd gkdcloud/ja3guard
sudo bash install.sh
```

脚本会自动完成：

1. 检测操作系统和 CPU 架构
2. 安装系统依赖（curl, git, ca-certificates 等）
3. 检查/安装 Go 1.22+（已有则跳过）
4. 检查 80/443 端口占用并提示
5. 编译 JA3 Guard 二进制文件
6. 交互式生成配置文件（域名、上游地址、密码等）
7. 创建 systemd 服务（安全加固 + 低端口绑定）
8. 配置防火墙放行（ufw / firewalld）
9. 启动服务并验证

安装完成后：

```bash
# 查看状态
systemctl status ja3guard

# 查看实时日志
journalctl -u ja3guard -f

# 重启
systemctl restart ja3guard

# 停止
systemctl stop ja3guard
```

**升级**（拉取新代码后）：

```bash
cd /opt/gkdcloud/ja3guard
git pull
sudo bash install.sh upgrade
```

**卸载**（保留数据目录）：

```bash
sudo bash install.sh uninstall
```

---

### 方式二：Docker 部署

需要 Docker + Docker Compose。

#### 第一步：克隆并进入目录

```bash
cd /opt  # 或其他你喜欢的目录
git clone <repo-url> gkdcloud
cd gkdcloud/ja3guard
```

#### 第二步：创建配置文件

```bash
mkdir -p data
cp config.example.json data/config.json
```

编辑 `data/config.json`：

```json
{
  "domain": "sub.example.com",
  "upstream": "http://host.docker.internal:8080",
  "listen_https": ":443",
  "listen_admin": ":8443",
  "admin_password": "你的管理面板密码",
  "guard_secret": "随机字符串-用于PHP验证",
  "acme_email": "your@email.com",
  "data_dir": "/data",
  "log_enabled": true
}
```

#### 配置项说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `domain` | 是 | 订阅子域名，用于申请 Let's Encrypt 证书 |
| `upstream` | 是 | 上游 Nginx/PHP 地址。Docker 容器内访问宿主机用 `host.docker.internal` |
| `listen_https` | 否 | HTTPS 监听地址，默认 `:443` |
| `listen_admin` | 否 | 管理面板监听地址，默认 `:8443` |
| `admin_password` | 是 | 管理面板密码（Basic Auth） |
| `guard_secret` | 是 | 共享密钥，必须与 PHP `domainReplace.php` 中的 `guard_secret` 一致 |
| `acme_email` | 否 | Let's Encrypt 注册邮箱，建议填写以接收证书到期提醒 |
| `data_dir` | 否 | 数据目录，默认 `/data`（Docker 内路径） |
| `log_enabled` | 否 | 是否记录请求日志，默认 `true`。采集完指纹后可在面板关闭 |

#### 第三步：配置 PHP 端

编辑 SSPanel 的 `config/domainReplace.php`：

```php
return [
    'enabled' => true,

    // 必须与 JA3 Guard config.json 中的 guard_secret 完全一致
    'guard_secret' => '随机字符串-用于PHP验证',

    'mapping' => [
        '*.gnodecn.com' => '*.gkdnode.net',
    ],
];
```

#### 第四步：配置上游 Nginx

JA3 Guard 会将请求反代到你的 Nginx。确保 Nginx 的订阅 server block 监听在配置的 `upstream` 端口上。

示例 Nginx 配置（监听 8080，仅接受本地连接）：

```nginx
server {
    listen 127.0.0.1:8080;
    server_name sub.example.com;

    # 你原有的 SSPanel 订阅配置
    root /www/sspanel/public;
    index index.php;

    location / {
        try_files $uri /index.php$is_args$args;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

#### 第五步：配置 DNS

将订阅子域名的 DNS A 记录直接指向服务器 IP，**不开启 CDN 代理**。

如果使用 GTM（全局流量管理），在 GTM 中配置该子域名解析到三网质量好的反代服务器。

#### 第六步：启动服务

```bash
docker compose up -d --build
```

首次启动会自动向 Let's Encrypt 申请证书（需要 80 和 443 端口可达），日志查看：

```bash
docker logs -f ja3guard
```

正常输出：

```
[HTTPS] 订阅代理启动 :443 (域名: sub.example.com → 上游: http://host.docker.internal:8080)
[Admin] 管理面板启动 :8443
[HTTP] ACME 验证 + 重定向启动 :80
JA3 Guard 已就绪
```

## 使用：采集 JA3 指纹

### 第一步：访问管理面板

管理面板绑定在 127.0.0.1:8443，需要通过 SSH 隧道访问：

```bash
ssh -L 8443:localhost:8443 user@your-server
```

然后浏览器打开 `http://localhost:8443`，输入密码登录。

### 第二步：触发一次真实请求

用你自己的 **iOS 设备 + Shadowrocket**，订阅地址改为新的子域名：

```
https://sub.example.com/link/你的token?sub=3
```

更新一次订阅。

### 第三步：查看并加白

进入管理面板 **JA3 Fingerprints** 页面：

- 找到 User-Agent 包含 `Shadowrocket` 的那条 JA3 hash
- 点击 **Add** 按钮
- 填入备注（如 `iOS 17 Shadowrocket`）

也可以在 **Whitelist** 页面手动添加。

### 第四步：验证

1. 用 Shadowrocket 再次更新订阅
2. Dashboard 显示该请求状态为 **TRUSTED**
3. 检查订阅内容中的域名是否已替换为隐藏域名

### 第五步（可选）：关闭日志

指纹采集完成后，在 **Settings** 页面关闭 Request Logging 以节省磁盘。

## 日常维护

### JA3 指纹什么时候会变？

| 场景 | 是否变化 | 操作 |
|------|---------|------|
| iOS 小版本更新（17.1 → 17.2） | 一般不变 | 无需操作 |
| iOS 大版本升级（17 → 18） | 可能变化 | 开启日志，采集新指纹，加入白名单 |
| Shadowrocket 更新 | 不变 | 无需操作（它使用系统 TLS 栈） |
| 换手机（同 iOS 版本） | 不变 | 无需操作 |

**建议**：每次 iOS 大版本发布后，开启日志跑一两天，检查是否有新的 JA3 hash 出现。

### 白名单管理原则

- 保留当前 iOS 大版本 + 上一代的 JA3 hash（通常 2-3 个）
- 老版本用户全部升级后，可移除旧 hash
- **不确定的 hash 宁可不加**

### 日志清理

日志自动保留 30 天。也可在 Settings 页面手动清理，或通过 API：

```bash
curl -u :密码 -X POST http://localhost:8443/api/logs/cleanup?days=7
```

## 同机部署（主站与订阅在同一台服务器）

如果主站 Nginx 已经占用了 80/443 端口，需要用 Nginx Stream 模块按 SNI 分流：

### Nginx 主配置（`nginx.conf`）

```nginx
stream {
    map $ssl_preread_server_name $backend {
        sub.example.com     127.0.0.1:4433;   # JA3 Guard
        default              127.0.0.1:8443_ssl; # 主站 Nginx HTTPS
    }

    # 端口 443 入口，按 SNI 分流（不终止 TLS，保留原始 ClientHello）
    server {
        listen 443;
        proxy_pass $backend;
        ssl_preread on;
    }
}
```

此配置下：
- 访问 `sub.example.com:443` → 转发到 JA3 Guard（保留原始 TLS 握手，JA3 不受影响）
- 访问其他域名 → 转发到主站 Nginx

对应修改 `docker-compose.yml`，将 443 映射改为 4433：

```yaml
ports:
  - "80:80"
  - "127.0.0.1:4433:443"     # JA3 Guard TLS
  - "127.0.0.1:8443:8443"    # Admin
```

ACME HTTP-01 验证的 80 端口也需要类似处理，在 Nginx HTTP server 中加一个 location：

```nginx
server {
    listen 80;
    server_name sub.example.com;

    # ACME 验证转发到 JA3 Guard
    location /.well-known/acme-challenge/ {
        proxy_pass http://127.0.0.1:8080;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
```

对应修改 `docker-compose.yml`：

```yaml
ports:
  - "127.0.0.1:8080:80"      # ACME HTTP-01
  - "127.0.0.1:4433:443"     # JA3 Guard TLS
  - "127.0.0.1:8443:8443"    # Admin
```

## 管理面板 API

管理面板所有 API 使用 Basic Auth（用户名留空，密码为 `admin_password`）。

### 统计

```
GET /api/stats
```

```json
{"total_requests": 1234, "trusted_count": 890, "blocked_count": 344}
```

### JA3 指纹聚合

```
GET /api/logs/summary
```

```json
{
  "summaries": [
    {
      "ja3_hash": "cd08e31494f9531f560d64c695473da9",
      "count": 890,
      "last_ua": "Shadowrocket/1990 CFNetwork/1568 Darwin/24.0.0",
      "last_ip": "1.2.3.4",
      "last_seen": "2026-02-17 14:30:01",
      "in_whitelist": true
    }
  ]
}
```

### 请求日志

```
GET /api/logs?page=1&size=50
```

### 白名单

```
GET    /api/whitelist                                  # 列出白名单
POST   /api/whitelist    {"ja3_hash":"...","note":""}  # 添加
DELETE /api/whitelist/<hash>                            # 删除
```

### 设置

```
GET  /api/settings                           # 查看当前设置
POST /api/settings   {"log_enabled": false}  # 更新
```

### 日志清理

```
POST /api/logs/cleanup?days=30    # 清理 N 天前的日志
```

## 数据文件

所有运行时数据存放在 `data/` 目录（Docker 卷挂载）：

```
data/
├── config.json          # 配置文件（手动创建）
├── certs/               # Let's Encrypt 证书（自动管理）
├── whitelist.json       # JA3 白名单（面板管理）
└── ja3_logs.jsonl       # 请求日志（JSONL 格式，自动轮转）
```

备份只需打包 `data/` 目录。

## 安全说明

### 为什么不在 PHP 层做 JA3 验证？

PHP 运行在应用层，收到的是已经完成 TLS 握手后的 HTTP 请求。TLS Client Hello 中的 JA3 信息在握手阶段就已丢失，PHP 无法获取。JA3 Guard 在 TCP 层截获原始字节，是唯一能计算 JA3 的位置。

### 防绕过机制

- **Guard Secret**：JA3 Guard 向上游注入 `X-Guard-Secret` header，PHP 用 `hash_equals()` 验证。即使攻击者绕过 JA3 Guard 直连 Nginx，没有正确的 secret 也无法伪造 `X-JA3-Trusted: 1`
- **Header 剥离**：JA3 Guard 在转发前会删除客户端请求中的 `X-JA3-Trusted`、`X-Guard-Secret` 等 header，防止客户端伪造
- **Nginx 仅监听本地**：上游 Nginx 绑定 `127.0.0.1`，不暴露到公网

### 宁可错杀，不可放过

- 白名单为空 → 所有人都拿正常域名（安全默认值）
- JA3 为空或解析失败 → 视为不信任
- 新 iOS 版本改变了 JA3 → 需要手动采集并加白，期间用户拿正常域名

## 常见问题

### 证书申请失败？

1. 确认 DNS 已经指向服务器且生效：`dig sub.example.com`
2. 确认 80 端口可从外部访问：`curl http://sub.example.com`
3. 检查日志：`docker logs ja3guard`
4. Let's Encrypt 有频率限制，同一域名每周最多 5 次。测试时可以先用 staging 环境

### 上游连接失败（502 Bad Gateway）？

1. 确认 Nginx 在监听配置的 upstream 端口
2. Docker 内访问宿主机用 `host.docker.internal`（已在 docker-compose.yml 中配置）
3. 检查防火墙是否允许 Docker 网桥访问宿主机端口

### 用户反馈订阅内容没有替换域名？

1. 管理面板检查该用户的 JA3 hash 是否在白名单中
2. 确认 PHP 端 `domainReplace.php` 的 `guard_secret` 与 JA3 Guard 配置一致
3. 确认 `enabled` 为 `true` 且 `mapping` 不为空

### 如何完全重置？

```bash
docker compose down
rm -rf data/ja3_logs.jsonl data/whitelist.json
docker compose up -d
```

证书不需要删除，会自动续期。
