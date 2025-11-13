# 更新日志

## v1.1.0 (2024-11-13)

### 🎉 新增功能

#### 1. 用户认证系统
- ✅ 登录/登出功能
- ✅ Token 认证机制（24小时有效期）
- ✅ 密码加密存储（SHA-256）
- ✅ 修改密码功能
- ✅ 默认管理员账号：`admin` / `admin123`

**使用方法：**
```bash
# 首次访问会跳转到登录页面
# 默认账号：admin
# 默认密码：admin123
# 登录后请立即修改密码！
```

#### 2. 离线授权支持
- ✅ 支持上传离线授权的 tar.gz 包
- ✅ 自动解压并安装到目标服务器
- ✅ 可选在线/离线模式切换

**使用方法：**
1. 在创建实例时，勾选"使用离线授权模式"
2. 上传离线授权的 `soga.tar.gz` 文件
3. 系统会自动处理并部署到目标服务器

#### 3. 一键更新功能
- ✅ 自动备份当前版本
- ✅ 自动更新依赖
- ✅ 保留用户数据
- ✅ 失败自动回滚

**使用方法：**
```bash
# 1. 下载新版本到 soga-panel 目录
wget https://your-server/soga-panel.tar.gz

# 2. 运行更新脚本
chmod +x update.sh
./update.sh

# 脚本会自动：
# - 备份当前版本
# - 停止服务
# - 解压新版本
# - 更新依赖
# - 测试启动
# - 重启服务
```

#### 4. Soga 版本更新
- ✅ 支持在线更新 Soga 版本
- ✅ 支持离线更新（上传新的 tar.gz）
- ✅ 更新失败自动回滚到备份版本

**API 接口：**
```bash
POST /api/soga/:serverId/:instanceName/update
```

### 🐛 Bug 修复

#### 1. 修复下载错误
- ✅ 改进错误处理，提供详细的错误信息
- ✅ 添加网络连接测试
- ✅ 增加下载超时和重试机制
- ✅ 验证下载文件的有效性

#### 2. 优化文件上传
- ✅ 支持大文件上传（最大 50MB）
- ✅ Base64 编码传输离线包
- ✅ 自动清理临时文件

### 📝 文档更新

- ✅ 添加认证系统说明
- ✅ 添加离线模式使用指南
- ✅ 添加更新脚本使用说明
- ✅ 更新 API 文档

---

## 使用指南

### 认证系统

#### 首次登录
1. 访问 `http://localhost:3000`
2. 会自动跳转到登录页面
3. 使用默认账号登录：
   - 用户名：`admin`
   - 密码：`admin123`

#### 修改密码
1. 登录后，通过 API 修改密码：
```bash
curl -X POST http://localhost:3000/api/auth/change-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "oldPassword": "admin123",
    "newPassword": "new_secure_password"
  }'
```

或在浏览器控制台执行：
```javascript
fetch('/api/auth/change-password', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    oldPassword: 'admin123',
    newPassword: 'new_secure_password'
  })
})
.then(res => res.json())
.then(console.log);
```

#### 登出
点击页面上的登出按钮，或清除浏览器 localStorage：
```javascript
localStorage.clear();
window.location.href = '/login.html';
```

### 离线授权模式

#### 准备离线包
离线授权包应该是一个包含 `soga` 可执行文件的 tar.gz 压缩包：
```bash
# 示例：打包 soga 文件
tar -czf soga.tar.gz soga
```

#### 使用离线模式
1. 创建实例时，勾选"使用离线授权模式"
2. 点击"选择文件"上传 `soga.tar.gz`
3. 填写其他配置信息
4. 点击"创建实例"

#### 更新离线版本
```bash
curl -X POST http://localhost:3000/api/soga/{serverId}/{instanceName}/update \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "offlineMode": true,
      "sogaPackage": "BASE64_ENCODED_TAR_GZ"
    }
  }'
```

### 在线授权模式

#### 选择版本
创建实例时，在"Soga 版本"下拉框中选择：
- `latest` - 最新版本（推荐）
- `v0.10.5` - 指定版本
- 其他版本...

#### 更新在线版本
```bash
curl -X POST http://localhost:3000/api/soga/{serverId}/{instanceName}/update \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "offlineMode": false,
      "sogaVersion": "latest"
    }
  }'
```

### 一键更新面板

#### 步骤
```bash
# 1. 下载新版本
cd /path/to/soga-panel
wget https://your-server/soga-panel.tar.gz

# 2. 运行更新脚本
chmod +x update.sh
./update.sh

# 3. 按提示操作
```

#### 更新内容
- ✅ 后端代码
- ✅ 前端页面
- ✅ 依赖包
- ❌ 不会覆盖 `data/` 目录（保留用户数据）

#### 回滚
如果更新失败，可以手动回滚：
```bash
# 查看备份目录
ls -d ../backup_*

# 恢复数据
cp -r ../backup_YYYYMMDD_HHMMSS/data ./

# 重新部署旧版本
```

---

## 安全建议

### 1. 修改默认密码
**强烈建议**首次登录后立即修改默认密码！

### 2. 使用强密码
- 长度至少 12 位
- 包含大小写字母、数字和特殊字符
- 不使用常见密码

### 3. 定期备份
```bash
# 备份数据
tar -czf backup_$(date +%Y%m%d).tar.gz data/

# 定期备份（可添加到 crontab）
0 2 * * * cd /path/to/soga-panel && tar -czf backups/backup_$(date +\%Y\%m\%d).tar.gz data/
```

### 4. 限制访问
使用 Nginx 限制访问 IP：
```nginx
location / {
    allow 1.2.3.4;  # 你的 IP
    deny all;
    proxy_pass http://localhost:3000;
}
```

### 5. 启用 HTTPS
参考 `DEPLOYMENT.md` 中的 HTTPS 配置说明。

---

## 常见问题

### Q: 忘记密码怎么办？
A: 删除认证文件，系统会重新生成默认账号：
```bash
rm data/auth.json
# 重启服务后，默认账号会重新生成
```

### Q: 离线包上传失败？
A: 检查：
1. 文件格式是否为 `.tar.gz` 或 `.tgz`
2. 文件大小是否超过 50MB
3. 网络连接是否稳定

### Q: 更新脚本失败怎么办？
A: 
1. 查看错误信息
2. 手动恢复备份：`cp -r ../backup_*/data ./`
3. 重新部署旧版本

### Q: Token 过期怎么办？
A: Token 有效期 24 小时，过期后需要重新登录。

---

## API 变更

### 新增接口

#### 认证相关
- `POST /api/auth/login` - 登录
- `POST /api/auth/logout` - 登出
- `POST /api/auth/change-password` - 修改密码
- `GET /api/auth/verify` - 验证 Token

#### Soga 管理
- `POST /api/soga/:serverId/:instanceName/update` - 更新 Soga 版本

### 接口变更
所有 `/api/servers` 和 `/api/soga` 下的接口都需要 Token 认证：
```bash
# 添加 Authorization 头
curl http://localhost:3000/api/servers \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 升级说明

从 v1.0.0 升级到 v1.1.0：

### 1. 备份数据
```bash
tar -czf backup_before_upgrade.tar.gz data/
```

### 2. 停止服务
```bash
pm2 stop soga-panel
# 或
pkill -f "node server/app.js"
```

### 3. 解压新版本
```bash
tar -xzf soga-panel.tar.gz --strip-components=1 \
    --exclude='data' \
    --exclude='node_modules'
```

### 4. 安装依赖
```bash
rm -rf node_modules package-lock.json
npm install --ignore-scripts
```

### 5. 运行前端更新
```bash
bash update-frontend.sh
```

### 6. 重启服务
```bash
pm2 start server/app.js --name soga-panel
# 或
npm start
```

### 7. 首次登录
访问 http://localhost:3000，使用默认账号 `admin`/`admin123` 登录。

---

## 技术细节

### 认证机制
- 密码使用 SHA-256 加密存储
- Token 使用 crypto.randomBytes 生成
- Token 有效期 24 小时
- 认证信息存储在 `data/auth.json`

### 离线包格式
```
soga.tar.gz
└── soga  (可执行文件)
```

### 更新流程
1. 备份当前版本到 `../backup_YYYYMMDD_HHMMSS/`
2. 停止服务
3. 解压新版本（保留 data 目录）
4. 更新依赖
5. 测试启动
6. 重启服务
7. 失败则回滚

---

## 反馈与支持

如有问题或建议，请查看：
- 完整文档：`README.md`
- 故障排查：`TROUBLESHOOTING.md`
- API 文档：`API.md`
