# Soga Panel 项目结构

```
soga-panel/
├── server/                         # 后端服务器代码
│   ├── app.js                      # 主应用入口
│   ├── routes/                     # API 路由
│   │   ├── server.js               # 服务器管理路由
│   │   └── soga.js                 # Soga 实例管理路由
│   ├── services/                   # 业务逻辑服务
│   │   ├── ssh.js                  # SSH 连接服务
│   │   └── soga-installer.js       # Soga 安装服务
│   └── utils/                      # 工具函数
│       └── config-generator.js     # 配置文件生成器
├── public/                         # 前端静态文件
│   ├── index.html                  # 主页面
│   ├── css/
│   │   └── style.css               # 样式文件
│   └── js/
│       └── main.js                 # 前端逻辑
├── config-templates/               # 配置文件模板
│   ├── soga.conf.template          # Soga 主配置模板
│   ├── route.toml.template         # 路由配置模板
│   └── blocklist.template          # 黑名单模板
├── data/                           # 数据存储目录
│   └── servers.json                # 服务器和实例数据（运行时生成）
├── package.json                    # Node.js 项目配置
├── .gitignore                      # Git 忽略文件
├── README.md                       # 项目说明文档
├── DEPLOYMENT.md                   # 部署说明文档
└── API.md                          # API 接口文档
```

## 文件说明

### 后端文件

#### server/app.js
主应用入口文件，负责：
- 初始化 Express 应用
- 配置中间件
- 注册路由
- 启动 HTTP 服务器
- 初始化数据目录

#### server/routes/server.js
服务器管理路由，提供以下功能：
- GET /api/servers - 获取服务器列表
- POST /api/servers - 添加服务器
- POST /api/servers/:id/test - 测试服务器连接
- GET /api/servers/:id/info - 获取服务器信息
- DELETE /api/servers/:id - 删除服务器

#### server/routes/soga.js
Soga 实例管理路由，提供以下功能：
- GET /api/soga/instances - 获取实例列表
- POST /api/soga/install - 安装 Soga 实例
- GET /api/soga/:serverId/:instanceName/status - 获取实例状态
- POST /api/soga/:serverId/:instanceName/start - 启动实例
- POST /api/soga/:serverId/:instanceName/stop - 停止实例
- POST /api/soga/:serverId/:instanceName/restart - 重启实例
- GET /api/soga/:serverId/:instanceName/logs - 获取实例日志
- PUT /api/soga/:serverId/:instanceName/config - 更新实例配置
- DELETE /api/soga/:serverId/:instanceName - 删除实例

#### server/services/ssh.js
SSH 连接服务类，负责：
- 建立 SSH 连接
- 执行远程命令
- 上传文件
- 管理 systemd 服务
- 获取系统信息

主要方法：
- `connect()` - 连接服务器
- `testConnection()` - 测试连接
- `execCommand(command)` - 执行命令
- `uploadContent(content, path)` - 上传文件内容
- `getServiceStatus(name)` - 获取服务状态
- `startService(name)` - 启动服务
- `stopService(name)` - 停止服务
- `restartService(name)` - 重启服务
- `getServiceLogs(name, lines)` - 获取服务日志

#### server/services/soga-installer.js
Soga 安装服务类，负责：
- 下载 Soga 二进制文件
- 创建工作目录
- 生成配置文件
- 创建 systemd 服务
- 启动 Soga 服务
- 更新配置
- 卸载 Soga

主要方法：
- `install(instanceName, config)` - 安装实例
- `updateConfig(instanceName, config)` - 更新配置
- `uninstall(instanceName)` - 卸载实例
- `uploadConfigs(instanceName, workDir, config)` - 上传配置文件
- `createSystemdService(instanceName, workDir)` - 创建 systemd 服务

#### server/utils/config-generator.js
配置文件生成器类，负责：
- 生成 soga.conf 配置
- 生成 route.toml 路由配置
- 生成 blocklist 黑名单
- 验证配置参数

主要方法：
- `generateSogaConf(config)` - 生成 Soga 主配置
- `generateRouteToml(routeConfig)` - 生成路由配置
- `generateBlockList(blockList)` - 生成黑名单
- `validateConfig(config)` - 验证配置

### 前端文件

#### public/index.html
主页面，包含：
- 服务器管理界面
- 实例管理界面
- 添加服务器模态框
- 创建实例模态框
- 日志查看模态框

#### public/css/style.css
样式文件，定义了：
- 全局样式和变量
- 布局样式（容器、卡片、模态框）
- 组件样式（按钮、表单、标签）
- 响应式设计
- 动画效果

#### public/js/main.js
前端逻辑，实现：
- 标签页切换
- 模态框管理
- API 调用封装
- 服务器列表渲染
- 实例列表渲染
- 表单提交处理
- 实时状态更新

主要函数：
- `apiCall(endpoint, options)` - API 调用封装
- `loadServers()` - 加载服务器列表
- `renderServers()` - 渲染服务器列表
- `loadInstances()` - 加载实例列表
- `renderInstances()` - 渲染实例列表
- `handleAddServer(e)` - 处理添加服务器
- `handleCreateInstance(e)` - 处理创建实例
- `testServer(id)` - 测试服务器连接
- `startInstance(serverId, name)` - 启动实例
- `viewLogs(serverId, name)` - 查看日志

### 配置模板

#### config-templates/soga.conf.template
Soga 主配置文件模板，包含：
- 面板对接配置
- 证书配置
- 日志配置
- DNS 配置
- 性能配置
- 高级配置
- 规则列表配置

#### config-templates/route.toml.template
路由配置文件模板，支持：
- 直连规则（Direct）
- 代理规则（Proxy）
- 阻断规则（Block）
- 包含详细的配置示例和说明

#### config-templates/blocklist.template
黑名单配置模板，包含：
- 广告域名黑名单
- 追踪器黑名单
- 恶意网站黑名单
- IP/CIDR 黑名单
- 正则表达式规则
- 详细的使用说明

### 数据文件

#### data/servers.json
存储所有服务器和实例的配置信息，结构：
```json
{
  "servers": [
    {
      "id": "唯一ID",
      "name": "服务器名称",
      "host": "IP地址",
      "port": 22,
      "username": "用户名",
      "password": "密码（加密存储）",
      "privateKey": "私钥内容",
      "createdAt": "创建时间"
    }
  ],
  "instances": [
    {
      "id": "唯一ID",
      "serverId": "关联的服务器ID",
      "name": "实例名称",
      "config": {
        "panelType": "面板类型",
        "panelUrl": "面板地址",
        "panelKey": "面板密钥",
        "nodeId": "节点ID",
        ...
      },
      "status": "运行状态",
      "createdAt": "创建时间",
      "updatedAt": "更新时间"
    }
  ]
}
```

### 文档文件

#### README.md
项目说明文档，包含：
- 项目概述
- 功能特性
- 技术栈
- 目录结构
- 快速开始
- 使用说明
- 安装流程
- API 接口
- 配置文件说明
- 注意事项
- 故障排查
- 开发计划

#### DEPLOYMENT.md
部署说明文档，包含：
- 环境要求
- 详细部署步骤
- Nginx 反向代理配置
- HTTPS 配置
- 防火墙配置
- 目标服务器准备
- 使用流程
- 故障排查
- 安全建议
- 维护任务
- 性能优化
- 常见问题

#### API.md
API 接口文档，包含：
- 接口基础信息
- 响应格式
- 所有 API 详细说明
- 请求参数说明
- 响应示例
- 错误代码
- 使用示例（cURL、JavaScript）
- 注意事项

## 数据流程

### 添加服务器流程
1. 用户在前端填写服务器信息
2. 前端发送 POST 请求到 /api/servers
3. 后端验证参数
4. 生成唯一 ID
5. 保存到 data/servers.json
6. 返回成功响应
7. 前端更新服务器列表

### 创建实例流程
1. 用户在前端填写实例配置
2. 前端发送 POST 请求到 /api/soga/install
3. 后端验证参数
4. SSH 连接目标服务器
5. 检测系统架构
6. 下载 Soga 二进制文件
7. 创建工作目录 /etc/soga/{实例名称}/
8. 生成并上传配置文件
9. 创建 systemd 服务文件
10. 启动并启用服务
11. 保存实例信息到 data/servers.json
12. 返回成功响应
13. 前端更新实例列表

### 管理实例流程
1. 用户点击启动/停止/重启按钮
2. 前端发送对应的 POST 请求
3. 后端通过 SSH 执行 systemctl 命令
4. 返回操作结果
5. 前端更新实例状态

## 技术细节

### SSH 连接
使用 node-ssh 库建立 SSH 连接，支持：
- 密码认证
- 密钥认证
- 自定义端口
- 命令执行
- 文件上传

### systemd 服务管理
每个 Soga 实例都是独立的 systemd 服务：
- 服务名称：soga-{实例名称}
- 服务文件：/etc/systemd/system/soga-{实例名称}.service
- 工作目录：/etc/soga/{实例名称}/
- 自动重启
- 日志记录到 journalctl

### 配置文件生成
根据用户输入动态生成配置文件：
- soga.conf：主配置文件
- route.toml：路由规则（可选）
- blocklist：黑名单（可选）
- cert.pem：证书文件（可选）
- key.pem：私钥文件（可选）

### 数据持久化
使用 JSON 文件存储数据：
- 位置：data/servers.json
- 格式：JSON
- 自动备份（建议）
- 支持手动编辑

## 扩展性

### 添加新面板类型
在 config-generator.js 中添加对应的配置生成逻辑

### 添加新功能
1. 在 routes/ 中添加新路由
2. 在 services/ 中添加业务逻辑
3. 在前端添加对应的 UI 和调用

### 自定义配置模板
修改 config-templates/ 中的模板文件

## 注意事项

1. 敏感信息（密码、密钥）存储在 data/servers.json 中，建议加密
2. 定期备份 data/servers.json
3. SSH 连接超时时间为 30 秒
4. Soga 下载使用 GitHub Releases
5. 支持的系统架构：amd64, arm64, armv7, 386
