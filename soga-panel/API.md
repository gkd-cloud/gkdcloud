# Soga Panel API 文档

## 基础信息

- **Base URL**: `http://localhost:3000/api`
- **Content-Type**: `application/json`
- **编码**: UTF-8

## 响应格式

### 成功响应
```json
{
  "success": true,
  "data": {...},
  "message": "操作成功"
}
```

### 错误响应
```json
{
  "error": "错误信息"
}
```

## 服务器管理 API

### 1. 获取服务器列表

**接口**: `GET /api/servers`

**请求参数**: 无

**响应示例**:
```json
{
  "servers": [
    {
      "id": "1234567890",
      "name": "香港节点-01",
      "host": "192.168.1.100",
      "port": 22,
      "username": "root",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 2. 添加服务器

**接口**: `POST /api/servers`

**请求参数**:
```json
{
  "name": "香港节点-01",
  "host": "192.168.1.100",
  "port": 22,
  "username": "root",
  "password": "密码",
  "privateKey": "SSH 私钥内容（可选）"
}
```

**响应示例**:
```json
{
  "success": true,
  "server": {
    "id": "1234567890",
    "name": "香港节点-01",
    "host": "192.168.1.100",
    "port": 22,
    "username": "root",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 3. 测试服务器连接

**接口**: `POST /api/servers/:id/test`

**URL 参数**:
- `id`: 服务器 ID

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "message": "连接成功"
}
```

### 4. 获取服务器信息

**接口**: `GET /api/servers/:id/info`

**URL 参数**:
- `id`: 服务器 ID

**响应示例**:
```json
{
  "success": true,
  "info": {
    "os": "Ubuntu 22.04 LTS",
    "kernel": "5.15.0-58-generic",
    "arch": "x86_64",
    "cpu": "Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz",
    "memory": "16Gi",
    "disk": "100G"
  }
}
```

### 5. 删除服务器

**接口**: `DELETE /api/servers/:id`

**URL 参数**:
- `id`: 服务器 ID

**响应示例**:
```json
{
  "success": true
}
```

## Soga 实例管理 API

### 1. 获取实例列表

**接口**: `GET /api/soga/instances`

**请求参数**: 无

**响应示例**:
```json
{
  "instances": [
    {
      "id": "1234567890",
      "serverId": "9876543210",
      "name": "node-hk-01",
      "config": {
        "panelType": "sspanel",
        "panelUrl": "https://panel.example.com",
        "nodeId": 1
      },
      "status": "running",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 2. 安装 Soga 实例

**接口**: `POST /api/soga/install`

**请求参数**:
```json
{
  "serverId": "9876543210",
  "instanceName": "node-hk-01",
  "config": {
    "panelType": "sspanel",
    "panelUrl": "https://panel.example.com",
    "panelKey": "your-panel-key",
    "nodeId": 1,
    "certDomain": "example.com",
    "certFile": "证书文件内容（可选）",
    "keyFile": "私钥文件内容（可选）",
    "logLevel": "info",
    "checkInterval": 60,
    "userConnLimit": 0,
    "userSpeedLimit": 0,
    "enableDNS": false,
    "routeConfig": "路由配置内容（可选）",
    "blockList": "黑名单内容（可选）"
  }
}
```

**配置参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| panelType | string | 是 | 面板类型：sspanel, v2board, proxypanel, sspanel-uim |
| panelUrl | string | 是 | 面板地址，必须包含 http:// 或 https:// |
| panelKey | string | 是 | 面板密钥（SSPanel 的 muKey 或 V2board 的 Token） |
| nodeId | number | 是 | 节点 ID |
| certDomain | string | 否 | 证书域名 |
| certFile | string | 否 | 证书文件内容（PEM 格式） |
| keyFile | string | 否 | 私钥文件内容（PEM 格式） |
| logLevel | string | 否 | 日志级别：debug, info, warning, error，默认 info |
| checkInterval | number | 否 | 检测间隔（秒），默认 60 |
| userConnLimit | number | 否 | 单用户连接数限制，0 表示不限制 |
| userSpeedLimit | number | 否 | 单用户速度限制（Mbps），0 表示不限制 |
| enableDNS | boolean | 否 | 是否启用 DNS 服务，默认 false |
| routeConfig | string | 否 | route.toml 配置内容 |
| blockList | string | 否 | blocklist 配置内容 |

**响应示例**:
```json
{
  "success": true,
  "instance": {
    "id": "1234567890",
    "serverId": "9876543210",
    "name": "node-hk-01",
    "config": {...},
    "status": "running",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 3. 获取实例状态

**接口**: `GET /api/soga/:serverId/:instanceName/status`

**URL 参数**:
- `serverId`: 服务器 ID
- `instanceName`: 实例名称

**响应示例**:
```json
{
  "success": true,
  "status": {
    "active": true,
    "status": "active",
    "details": "● soga-node-hk-01.service - Soga Service - node-hk-01..."
  }
}
```

### 4. 启动实例

**接口**: `POST /api/soga/:serverId/:instanceName/start`

**URL 参数**:
- `serverId`: 服务器 ID
- `instanceName`: 实例名称

**响应示例**:
```json
{
  "success": true,
  "message": "服务启动成功"
}
```

### 5. 停止实例

**接口**: `POST /api/soga/:serverId/:instanceName/stop`

**URL 参数**:
- `serverId`: 服务器 ID
- `instanceName`: 实例名称

**响应示例**:
```json
{
  "success": true,
  "message": "服务停止成功"
}
```

### 6. 重启实例

**接口**: `POST /api/soga/:serverId/:instanceName/restart`

**URL 参数**:
- `serverId`: 服务器 ID
- `instanceName`: 实例名称

**响应示例**:
```json
{
  "success": true,
  "message": "服务重启成功"
}
```

### 7. 获取实例日志

**接口**: `GET /api/soga/:serverId/:instanceName/logs`

**URL 参数**:
- `serverId`: 服务器 ID
- `instanceName`: 实例名称

**Query 参数**:
- `lines`: 日志行数，默认 100

**响应示例**:
```json
{
  "success": true,
  "logs": "Jan 01 00:00:00 server soga[1234]: Starting Soga..."
}
```

### 8. 更新实例配置

**接口**: `PUT /api/soga/:serverId/:instanceName/config`

**URL 参数**:
- `serverId`: 服务器 ID
- `instanceName`: 实例名称

**请求参数**:
```json
{
  "config": {
    "panelType": "sspanel",
    "panelUrl": "https://panel.example.com",
    "panelKey": "new-panel-key",
    "nodeId": 2,
    "logLevel": "debug"
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "配置更新成功"
}
```

### 9. 删除实例

**接口**: `DELETE /api/soga/:serverId/:instanceName`

**URL 参数**:
- `serverId`: 服务器 ID
- `instanceName`: 实例名称

**响应示例**:
```json
{
  "success": true,
  "message": "卸载成功"
}
```

## 健康检查 API

### 健康检查

**接口**: `GET /api/health`

**请求参数**: 无

**响应示例**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 错误代码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 常见错误消息

| 错误消息 | 说明 | 解决方案 |
|---------|------|---------|
| 缺少必要参数 | 请求缺少必填字段 | 检查请求参数是否完整 |
| 服务器不存在 | 指定的服务器 ID 不存在 | 确认服务器 ID 是否正确 |
| 实例名称已存在 | 同一服务器上已有同名实例 | 使用不同的实例名称 |
| 连接失败 | SSH 连接目标服务器失败 | 检查服务器地址、端口、认证信息 |
| 下载失败 | Soga 二进制文件下载失败 | 检查目标服务器网络连接 |
| 该服务器上还有 Soga 实例 | 删除服务器前需先删除所有实例 | 先删除所有关联的实例 |

## 使用示例

### cURL 示例

#### 添加服务器
```bash
curl -X POST http://localhost:3000/api/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "香港节点-01",
    "host": "192.168.1.100",
    "port": 22,
    "username": "root",
    "password": "your-password"
  }'
```

#### 安装 Soga 实例
```bash
curl -X POST http://localhost:3000/api/soga/install \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "1234567890",
    "instanceName": "node-hk-01",
    "config": {
      "panelType": "sspanel",
      "panelUrl": "https://panel.example.com",
      "panelKey": "your-panel-key",
      "nodeId": 1,
      "logLevel": "info"
    }
  }'
```

#### 获取实例日志
```bash
curl http://localhost:3000/api/soga/1234567890/node-hk-01/logs?lines=200
```

### JavaScript 示例

```javascript
// 添加服务器
async function addServer() {
  const response = await fetch('/api/servers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: '香港节点-01',
      host: '192.168.1.100',
      port: 22,
      username: 'root',
      password: 'your-password'
    })
  });
  
  const data = await response.json();
  console.log(data);
}

// 启动实例
async function startInstance(serverId, instanceName) {
  const response = await fetch(
    `/api/soga/${serverId}/${instanceName}/start`,
    { method: 'POST' }
  );
  
  const data = await response.json();
  console.log(data);
}
```

## 注意事项

1. 所有请求和响应均使用 JSON 格式
2. 密码和密钥等敏感信息需妥善保管
3. 建议在生产环境中使用 HTTPS
4. API 响应时间取决于目标服务器的网络状况
5. 安装 Soga 实例通常需要 1-2 分钟
6. 建议定期备份 `data/servers.json` 文件

## 版本历史

### v1.0.0
- 初始 API 版本
- 支持服务器和实例的基本 CRUD 操作
