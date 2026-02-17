# JA3 Guard

TLS 指纹验证反向代理，用于保护订阅接口隐藏域名不被 GFW 主动探测发现。

支持 **Master / Node 分布式架构**：一台 Master 集中管理多台 Node 节点的白名单、日志和 SSH 操作。

## 原理

JA3 是基于 TLS Client Hello 报文生成的客户端指纹（MD5 hash），由 TLS 版本、密码套件、扩展列表等参数决定。不同操作系统和应用的 TLS 栈产生不同的 JA3 指纹，且**无法通过简单的 header 伪造**来仿冒。

JA3 Guard 在 TLS 握手阶段截获原始 ClientHello 字节，计算 JA3 hash，对比白名单后决定是否向上游传递「可信」标记。不在白名单中的请求只能拿到正常域名，**永远接触不到隐藏域名**。

```
宁可错杀，不可放过 —— GFW 仅需成功一次，隐藏域名就会泄露
```

## 架构

### 单节点模式

```
  iOS Shadowrocket ───TLS───► JA3 Guard Node (:443)
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
```

### Master / Node 分布式模式

```
                  ┌──────────────────────────────┐
                  │     Master (:8443)            │
                  │  ┌──────────────────────┐     │
                  │  │ 管理面板              │     │
                  │  │ - 节点管理 (SSH)      │     │
                  │  │ - 白名单管理 + 同步   │     │
                  │  │ - 汇总日志 + 统计     │     │
                  │  └──────────────────────┘     │
                  └──────┬───────┬───────┬────────┘
                    上报  │       │       │  上报
                  ┌──────┘       │       └──────┐
                  ▼              ▼               ▼
           ┌──────────┐  ┌──────────┐  ┌──────────┐
           │ Node A   │  │ Node B   │  │ Node C   │
           │ :443     │  │ :443     │  │ :443     │
           │ JA3+Nginx│  │ JA3+Nginx│  │ JA3+Nginx│
           └──────────┘  └──────────┘  └──────────┘
```

**Master** 只运行管理面板（:8443），负责：
- 管理子节点（添加、删除、SSH 远程操作）
- 统一管理白名单并推送到所有节点
- 接收节点上报的状态和日志

**Node** 运行完整的 JA3 反代 + Nginx + PHP，负责：
- TLS 握手阶段截获 JA3 指纹（:443）
- 反向代理到上游 Nginx/PHP
- 定期向 Master 上报状态和日志
- 自动同步 Master 下发的白名单

### 端口说明

| 模式 | 端口 | 协议 | 用途 |
|------|------|------|------|
| Master | 8443 | HTTP | 管理面板（节点管理、白名单、日志） |
| Node | 80 | HTTP | Let's Encrypt ACME HTTP-01 验证 + HTTPS 重定向 |
| Node | 443 | TLS | 订阅代理（JA3 指纹 → 反代到上游） |
| Node | 8443 | HTTP | 本地管理面板（调试用） |

---

## 安装

### 前置条件

- **Master 服务器**：任意 Linux VPS，仅需 8443 端口可达
- **Node 服务器**：独立 VPS，80/443 端口可用，DNS 直连（不走 CDN）
- 支持 Debian 11/12、Ubuntu 20.04+、CentOS/RHEL 8+，x86_64 和 ARM64

---

### 方式一：裸机一键部署（推荐）

#### 安装 Master（管理面板）

```bash
# 远程一键安装
curl -fsSL https://raw.githubusercontent.com/gkd-cloud/gkdcloud/main/ja3guard/install.sh | sudo bash -s -- master

# 或本地安装
cd /opt && git clone https://github.com/gkd-cloud/gkdcloud.git
cd gkdcloud/ja3guard
sudo bash install.sh master
```

Master 安装脚本会自动完成：

1. 检测操作系统和 CPU 架构
2. 安装系统依赖
3. 安装 Go 1.22+（已有则跳过）
4. 编译 JA3 Guard 二进制文件
5. 交互式生成 Master 配置（密码）
6. 创建 systemd 服务
7. 配置防火墙放行 8443 端口
8. 启动服务

**Master 不需要安装 Nginx/PHP**，也不占用 80/443 端口。

非交互式安装：

```bash
curl -fsSL <url>/install.sh | JA3_ADMIN_PASSWORD=yourpassword sudo -E bash -s -- master
```

#### 安装 Node（JA3 反代节点）

```bash
# 远程一键安装
curl -fsSL https://raw.githubusercontent.com/gkd-cloud/gkdcloud/main/ja3guard/install.sh | sudo bash -s -- node

# 或本地安装
cd /opt && git clone https://github.com/gkd-cloud/gkdcloud.git
cd gkdcloud/ja3guard
sudo bash install.sh node
```

> 不带参数时默认为 `node` 模式。

Node 安装脚本会自动完成：

1. 检测操作系统和 CPU 架构
2. 安装系统依赖
3. 安装 Go 1.22+（已有则跳过）
4. **安装 Nginx + PHP-FPM**
5. 检查 80/443 端口占用（ja3guard 自身占用会自动跳过）
6. 编译 JA3 Guard 二进制文件
7. 交互式生成 Node 配置（域名、上游、密码、Master 地址等）
8. **配置 Nginx 上游站点**
9. 创建 systemd 服务（带 CAP_NET_BIND_SERVICE 能力）
10. 配置防火墙放行 80/443/8443
11. 启动服务

非交互式安装：

```bash
curl -fsSL <url>/install.sh | \
  JA3_DOMAIN=sub.example.com \
  JA3_MASTER_URL=http://master-ip:8443 \
  JA3_NODE_TOKEN=your-node-token \
  JA3_NODE_NAME=node-hk-1 \
  sudo -E bash -s -- node
```

#### 环境变量参考

| 变量 | 说明 | 模式 |
|------|------|------|
| `JA3_MODE` | 安装模式: `master` 或 `node` | 通用 |
| `JA3_ADMIN_PASSWORD` | 管理面板密码（默认随机生成） | 通用 |
| `JA3_ACME_EMAIL` | ACME 邮箱 | 通用 |
| `JA3_DOMAIN` | 订阅域名 | Node |
| `JA3_UPSTREAM` | 上游地址（默认 127.0.0.1:8080） | Node |
| `JA3_WEBROOT` | SSPanel 网站根目录（默认 /www/sspanel/public） | Node |
| `JA3_MASTER_URL` | Master 地址（如 http://master-ip:8443） | Node |
| `JA3_NODE_TOKEN` | 节点令牌（从 Master 面板获取） | Node |
| `JA3_NODE_NAME` | 节点名称 | Node |

#### 常用命令

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

### 方式二：Docker 部署（仅限 Node 模式）

需要 Docker + Docker Compose。Docker 模式适合 Node 节点部署。

#### 第一步：克隆并进入目录

```bash
cd /opt
git clone https://github.com/gkd-cloud/gkdcloud.git
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
  "mode": "node",
  "domain": "sub.example.com",
  "upstream": "http://host.docker.internal:8080",
  "listen_https": ":443",
  "listen_admin": ":8443",
  "admin_password": "你的管理面板密码",
  "guard_secret": "随机字符串-用于PHP验证",
  "acme_email": "your@email.com",
  "data_dir": "/data",
  "log_enabled": true,
  "master_url": "http://master-ip:8443",
  "node_token": "从master面板获取",
  "node_name": "node-1",
  "report_interval": 60
}
```

#### 配置项说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `mode` | 否 | 运行模式，`master` 或 `node`（默认 `node`） |
| `domain` | Node | 订阅子域名，用于申请 Let's Encrypt 证书 |
| `upstream` | Node | 上游 Nginx/PHP 地址。Docker 容器内访问宿主机用 `host.docker.internal` |
| `listen_https` | 否 | HTTPS 监听地址，默认 `:443` |
| `listen_admin` | 否 | 管理面板监听地址，默认 `:8443` |
| `admin_password` | 是 | 管理面板密码（Basic Auth） |
| `guard_secret` | Node | 共享密钥，必须与 PHP `domainReplace.php` 中的 `guard_secret` 一致 |
| `acme_email` | 否 | Let's Encrypt 注册邮箱，建议填写 |
| `data_dir` | 否 | 数据目录，默认 `/data`（Docker 内路径） |
| `log_enabled` | 否 | 是否记录请求日志，默认 `true` |
| `master_url` | 否 | Master 服务器地址（Node 模式上报用） |
| `node_token` | 否 | 节点认证令牌（与 `master_url` 配套） |
| `node_name` | 否 | 节点名称标识 |
| `report_interval` | 否 | 上报间隔（秒），默认 60 |

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

确保 Nginx 的订阅 server block 监听在配置的 `upstream` 端口上。

示例 Nginx 配置（监听 8080，仅接受本地连接）：

```nginx
server {
    listen 127.0.0.1:8080;
    server_name sub.example.com;

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

#### 第六步：启动服务

```bash
docker compose up -d --build
```

首次启动会自动向 Let's Encrypt 申请证书（需要 80 和 443 端口可达）：

```bash
docker logs -f ja3guard
```

---

## 快速开始

### 部署流程

```
1. 安装 Master
   └── curl ... | sudo bash -s -- master

2. 登录 Master 管理面板
   └── http://master-ip:8443

3. 在 Nodes 标签页添加 Node 节点
   └── 填写 IP、SSH 信息
   └── 记录生成的 Token

4. 在 Node 服务器安装
   └── curl ... | sudo bash -s -- node
   └── 填写 Master 地址和 Token

5. 回到 Master 面板查看节点上线状态

6. 在白名单标签页管理 JA3 指纹
   └── 点击「同步到所有节点」
```

### 采集 JA3 指纹

1. **访问管理面板**：通过 SSH 隧道或直接访问 http://master-ip:8443
2. **触发请求**：用 iOS Shadowrocket 更新一次订阅
3. **查看指纹**：在 JA3 Fingerprints 页面找到 Shadowrocket 的 JA3 hash，点击 Add
4. **同步白名单**：在 Whitelist 页面点击「Sync to All Nodes」
5. **验证**：再次更新订阅，确认状态为 TRUSTED

---

## 日常维护

### JA3 指纹什么时候会变？

| 场景 | 是否变化 | 操作 |
|------|---------|------|
| iOS 小版本更新（17.1 → 17.2） | 一般不变 | 无需操作 |
| iOS 大版本升级（17 → 18） | 可能变化 | 开启日志，采集新指纹，加入白名单 |
| Shadowrocket 更新 | 不变 | 无需操作（它使用系统 TLS 栈） |
| 换手机（同 iOS 版本） | 不变 | 无需操作 |

### 白名单管理原则

- 保留当前 iOS 大版本 + 上一代的 JA3 hash（通常 2-3 个）
- 老版本用户全部升级后，可移除旧 hash
- **不确定的 hash 宁可不加**

### 日志清理

日志自动保留 30 天。也可在 Settings 页面手动清理，或通过 API：

```bash
curl -u :密码 -X POST http://localhost:8443/api/logs/cleanup?days=7
```

---

## 同机部署（主站与订阅在同一台服务器）

如果主站 Nginx 已经占用了 80/443 端口，需要用 Nginx Stream 模块按 SNI 分流：

### Nginx 主配置（`nginx.conf`）

```nginx
stream {
    map $ssl_preread_server_name $backend {
        sub.example.com     127.0.0.1:4433;   # JA3 Guard
        default              127.0.0.1:8443_ssl; # 主站 Nginx HTTPS
    }

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

对应修改 JA3 Guard 配置中的 `listen_https` 为 `:4433`。

ACME HTTP-01 验证的 80 端口也需要类似处理，在 Nginx HTTP server 中加一个 location：

```nginx
server {
    listen 80;
    server_name sub.example.com;

    location /.well-known/acme-challenge/ {
        proxy_pass http://127.0.0.1:8080;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
```

---

## 管理面板 API

所有管理 API 使用 Basic Auth（用户名留空，密码为 `admin_password`）。

### 通用 API

```
GET  /api/stats                              # 统计信息
GET  /api/logs?page=1&size=50                # 请求日志
GET  /api/logs/summary                       # JA3 指纹聚合
GET  /api/whitelist                          # 白名单列表
POST /api/whitelist    {"ja3_hash":"...","note":""}  # 添加白名单
DELETE /api/whitelist/<hash>                  # 删除白名单
GET  /api/settings                           # 查看设置
POST /api/settings     {"log_enabled": false} # 更新设置
POST /api/logs/cleanup?days=30               # 清理旧日志
```

### 节点管理 API（Master 模式）

```
GET    /api/nodes                            # 节点列表
POST   /api/nodes       {NodeInfo}           # 添加节点
GET    /api/nodes/<id>                       # 节点详情
PUT    /api/nodes/<id>   {NodeInfo}          # 更新节点
DELETE /api/nodes/<id>                       # 删除节点
POST   /api/nodes/<id>/ssh/test              # 测试 SSH 连接
POST   /api/nodes/<id>/ssh/exec  {"command":"..."}  # SSH 执行命令
GET    /api/nodes/<id>/ssh/info              # 获取系统信息
POST   /api/whitelist/sync                   # 推送白名单到所有节点
```

### 节点上报 API（Token 认证）

节点上报使用 `Authorization: Bearer <token>` 认证，不需要 Basic Auth。

```
POST /api/report         # 节点状态 + 日志上报
GET  /api/node/whitelist # 节点拉取白名单
```

### Nginx 管理 API

```
GET    /api/nginx/status                     # Nginx 状态
GET    /api/nginx/sites                      # 站点列表
POST   /api/nginx/sites  {name, config}      # 保存站点配置
GET    /api/nginx/sites/<name>               # 获取站点配置
DELETE /api/nginx/sites/<name>               # 删除站点
POST   /api/nginx/sites/<name>/toggle        # 启用/禁用站点
POST   /api/nginx/test                       # 测试 Nginx 配置
POST   /api/nginx/reload                     # 重载 Nginx
```

---

## 数据文件

所有运行时数据存放在 `data/` 目录：

```
data/
├── config.json          # 配置文件
├── certs/               # Let's Encrypt 证书（自动管理）
├── whitelist.json       # JA3 白名单
├── nodes.json           # 节点信息（Master 模式）
└── ja3_logs.jsonl       # 请求日志（JSONL 格式，自动轮转）
```

备份只需打包 `data/` 目录。

---

## 安全说明

### 为什么不在 PHP 层做 JA3 验证？

PHP 运行在应用层，收到的是已经完成 TLS 握手后的 HTTP 请求。TLS Client Hello 中的 JA3 信息在握手阶段就已丢失，PHP 无法获取。JA3 Guard 在 TCP 层截获原始字节，是唯一能计算 JA3 的位置。

### 防绕过机制

- **Guard Secret**：JA3 Guard 向上游注入 `X-Guard-Secret` header，PHP 用 `hash_equals()` 验证。即使攻击者绕过 JA3 Guard 直连 Nginx，没有正确的 secret 也无法伪造 `X-JA3-Trusted: 1`
- **Header 剥离**：JA3 Guard 在转发前会删除客户端请求中的 `X-JA3-Trusted`、`X-Guard-Secret` 等 header，防止客户端伪造
- **Nginx 仅监听本地**：上游 Nginx 绑定 `127.0.0.1`，不暴露到公网
- **节点 Token 认证**：节点与 Master 通信使用 Token 认证，防止未授权节点接入

### 宁可错杀，不可放过

- 白名单为空 → 所有人都拿正常域名（安全默认值）
- JA3 为空或解析失败 → 视为不信任
- 新 iOS 版本改变了 JA3 → 需要手动采集并加白，期间用户拿正常域名

---

## 常见问题

### 证书申请失败？

1. 确认 DNS 已经指向服务器且生效：`dig sub.example.com`
2. 确认 80 端口可从外部访问：`curl http://sub.example.com`
3. 检查日志：`journalctl -u ja3guard -f`
4. Let's Encrypt 有频率限制，同一域名每周最多 5 次

### 上游连接失败（502 Bad Gateway）？

1. 确认 Nginx 在监听配置的 upstream 端口
2. Docker 内访问宿主机用 `host.docker.internal`（已在 docker-compose.yml 中配置）
3. 检查防火墙是否允许本地连接

### 节点一直显示离线？

1. 确认 Node 配置中 `master_url` 和 `node_token` 正确
2. 确认 Node 能访问 Master 的 8443 端口：`curl http://master-ip:8443/api/report`
3. 检查 Node 日志：`journalctl -u ja3guard -f`
4. Master 判定离线阈值为 180 秒（3 倍上报间隔）

### 用户反馈订阅内容没有替换域名？

1. 管理面板检查该用户的 JA3 hash 是否在白名单中
2. 确认 PHP 端 `domainReplace.php` 的 `guard_secret` 与 JA3 Guard 配置一致
3. 确认 `enabled` 为 `true` 且 `mapping` 不为空

### 如何完全重置？

```bash
# 裸机部署
sudo systemctl stop ja3guard
sudo rm -f /opt/ja3guard/data/ja3_logs.jsonl /opt/ja3guard/data/whitelist.json
sudo systemctl start ja3guard

# Docker 部署
docker compose down
rm -rf data/ja3_logs.jsonl data/whitelist.json
docker compose up -d
```

证书不需要删除，会自动续期。
