# Soga SSR 对接面板

## 项目概述

这是一个基于 Node.js + Express 的 Soga 对接面板，用于一键部署和管理多个 Soga 实例。

## 功能特性

- 🚀 一键安装 Soga 到远程服务器
- 📝 自定义配置文件（soga.conf, route.toml, blocklist）
- 🔧 使用 systemd 管理多个独立的 Soga 实例
- 📊 实时查看服务状态
- 🎯 支持多服务器管理
- 🔄 配置文件热更新

## 技术栈

- 后端：Node.js + Express
- 前端：原生 HTML + CSS + JavaScript
- 远程执行：node-ssh
- 系统服务：systemd

## 目录结构

```
soga-panel/
├── server/
│   ├── app.js              # 主应用入口
│   ├── routes/
│   │   ├── server.js       # 服务器管理路由
│   │   └── soga.js         # Soga 实例管理路由
│   ├── services/
│   │   ├── ssh.js          # SSH 连接服务
│   │   └── soga-installer.js  # Soga 安装服务
│   └── utils/
│       └── config-generator.js  # 配置文件生成器
├── public/
│   ├── index.html          # 前端界面
│   ├── css/
│   │   └── style.css       # 样式文件
│   └── js/
│       └── main.js         # 前端逻辑
├── config-templates/       # 配置文件模板
│   ├── soga.conf.template
│   ├── route.toml.template
│   └── blocklist.template
├── data/
│   └── servers.json        # 服务器配置存储
├── package.json
└── README.md
```

## 快速开始

> **📢 一键更新**: 如果你已经安装了 Soga Panel，想要更新到最新版本，请查看 [更新指南](UPDATE_GUIDE.md)
>
> 一键更新命令：`cd soga-panel && bash auto-update.sh`

### 1. 安装依赖

**方法 1 - 使用安装脚本（推荐）：**

```bash
chmod +x install.sh
./install.sh
```

**方法 2 - 手动安装：**

```bash
npm install --legacy-peer-deps
```

如果速度慢，可使用国内镜像：

```bash
npm install --registry=https://registry.npmmirror.com --legacy-peer-deps
```

**遇到问题？** 查看 [故障排查文档](TROUBLESHOOTING.md)

### 2. 启动服务

```bash
npm start
```

### 3. 访问面板

打开浏览器访问：http://localhost:3000

## 使用说明

### 添加服务器

1. 点击"添加服务器"按钮
2. 填写服务器信息：
   - 服务器名称
   - IP 地址
   - SSH 端口（默认 22）
   - SSH 用户名（建议 root）
   - SSH 密码或密钥

### 创建 Soga 实例

1. 选择目标服务器
2. 点击"创建实例"
3. 填写配置信息：
   - 实例名称（用于 systemd 服务命名）
   - 面板类型（SSPanel, V2board, ProxyPanel 等）
   - 面板地址
   - 面板密钥/Token
   - 节点 ID
   - 其他配置参数

### 配置文件说明

#### soga.conf
主配置文件，包含：
- 面板对接信息
- 节点 ID
- 证书路径
- 日志配置
- 其他运行参数

#### route.toml
路由规则配置，支持：
- 域名路由
- IP 路由
- CIDR 路由
- 协议路由

#### blocklist
黑名单配置，支持：
- 域名黑名单
- IP 黑名单
- 正则表达式匹配

## 安装流程

面板执行以下步骤来安装 Soga：

1. 连接到目标服务器（SSH）
2. 检测系统架构（amd64/arm64）
3. 下载对应版本的 Soga 二进制文件
4. 创建 Soga 工作目录：`/etc/soga/{实例名称}/`
5. 生成并上传配置文件
6. 创建 systemd 服务文件：`/etc/systemd/system/soga-{实例名称}.service`
7. 启动并启用服务

## Systemd 服务管理

每个 Soga 实例都是独立的 systemd 服务：

```bash
# 查看服务状态
systemctl status soga-{实例名称}

# 启动服务
systemctl start soga-{实例名称}

# 停止服务
systemctl stop soga-{实例名称}

# 重启服务
systemctl restart soga-{实例名称}

# 查看日志
journalctl -u soga-{实例名称} -f
```

## API 接口

### 服务器管理

- `POST /api/servers` - 添加服务器
- `GET /api/servers` - 获取服务器列表
- `DELETE /api/servers/:id` - 删除服务器
- `POST /api/servers/:id/test` - 测试服务器连接

### Soga 实例管理

- `POST /api/soga/install` - 安装 Soga 实例
- `GET /api/soga/instances` - 获取实例列表
- `POST /api/soga/:instance/start` - 启动实例
- `POST /api/soga/:instance/stop` - 停止实例
- `POST /api/soga/:instance/restart` - 重启实例
- `GET /api/soga/:instance/status` - 获取实例状态
- `GET /api/soga/:instance/logs` - 获取实例日志
- `PUT /api/soga/:instance/config` - 更新配置
- `DELETE /api/soga/:instance` - 删除实例

## 配置文件模板变量

配置文件支持以下变量替换：

- `{{PANEL_TYPE}}` - 面板类型
- `{{PANEL_URL}}` - 面板地址
- `{{PANEL_KEY}}` - 面板密钥
- `{{NODE_ID}}` - 节点 ID
- `{{CERT_FILE}}` - 证书文件路径
- `{{KEY_FILE}}` - 密钥文件路径
- `{{INSTANCE_NAME}}` - 实例名称

## 注意事项

1. 确保目标服务器已开启 SSH 访问
2. 建议使用 root 用户进行安装
3. 确保服务器防火墙已开放必要端口
4. 定期备份配置文件
5. 生产环境建议使用 SSH 密钥认证

## 故障排查

### 安装失败

1. 检查 SSH 连接是否正常
2. 检查服务器网络连接
3. 查看面板日志输出

### 服务启动失败

1. 检查配置文件格式
2. 查看 systemd 日志：`journalctl -u soga-{实例名称} -n 50`
3. 验证面板对接信息是否正确

### 无法连接面板

1. 检查面板 URL 是否正确
2. 验证 Token/密钥是否有效
3. 检查节点 ID 是否存在
4. 确认服务器能访问面板地址

## 安全建议

1. 修改默认端口 3000
2. 配置反向代理（Nginx）
3. 启用 HTTPS
4. 使用强密码或 SSH 密钥
5. 限制面板访问 IP
6. 定期更新 Soga 版本

## 相关文档

- 📖 [快速开始指南](QUICKSTART.md) - 详细的部署步骤
- 🔄 [更新指南](UPDATE_GUIDE.md) - 一键更新到最新版本
- 📝 [API 文档](API.md) - 完整的 API 接口说明
- 🚀 [部署文档](DEPLOYMENT.md) - 生产环境部署指南
- 🔧 [故障排查](TROUBLESHOOTING.md) - 常见问题解决方案
- 📚 [项目结构](PROJECT_STRUCTURE.md) - 代码结构说明

## 开发计划

- [ ] 支持批量部署
- [ ] 添加配置文件版本控制
- [ ] 实现在线编辑配置
- [ ] 添加流量统计图表
- [x] 支持自动更新面板 ✅
- [ ] 添加告警通知功能

## 许可证

MIT License
