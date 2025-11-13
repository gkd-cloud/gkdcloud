# Soga Panel 部署说明

## 环境要求

### 面板服务器
- 操作系统：Linux / macOS / Windows
- Node.js：≥ 14.0
- 内存：≥ 512MB
- 磁盘：≥ 1GB

### 目标服务器（运行 Soga 的服务器）
- 操作系统：Linux（推荐 Ubuntu 20.04+、Debian 10+、CentOS 7+）
- 架构：x86_64 (amd64) / ARM64
- SSH 访问：支持密码或密钥认证
- Root 权限或 sudo 权限

## 部署步骤

### 1. 下载项目

```bash
# 下载项目文件
git clone <项目地址>
cd soga-panel

# 或直接解压项目包
unzip soga-panel.zip
cd soga-panel
```

### 2. 安装依赖

```bash
npm install
```

如果速度慢，可使用国内镜像：

```bash
npm install --registry=https://registry.npmmirror.com
```

### 3. 启动服务

#### 开发模式
```bash
npm run dev
```

#### 生产模式
```bash
npm start
```

#### 后台运行（推荐使用 PM2）

安装 PM2：
```bash
npm install -g pm2
```

启动面板：
```bash
pm2 start server/app.js --name soga-panel
```

设置开机自启：
```bash
pm2 startup
pm2 save
```

查看日志：
```bash
pm2 logs soga-panel
```

### 4. 访问面板

打开浏览器访问：`http://服务器IP:3000`

## 配置 Nginx 反向代理（可选）

### 安装 Nginx

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# CentOS
sudo yum install nginx
```

### 配置反向代理

创建配置文件 `/etc/nginx/sites-available/soga-panel`：

```nginx
server {
    listen 80;
    server_name panel.example.com;  # 修改为你的域名

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用配置：

```bash
# Ubuntu/Debian
sudo ln -s /etc/nginx/sites-available/soga-panel /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# CentOS
sudo cp /etc/nginx/sites-available/soga-panel /etc/nginx/conf.d/
sudo nginx -t
sudo systemctl reload nginx
```

### 配置 HTTPS（可选）

使用 Let's Encrypt 免费证书：

```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书并自动配置 Nginx
sudo certbot --nginx -d panel.example.com

# 设置自动续期
sudo certbot renew --dry-run
```

## 防火墙配置

### UFW (Ubuntu/Debian)

```bash
# 开放 SSH
sudo ufw allow 22/tcp

# 开放面板端口（如果不使用 Nginx）
sudo ufw allow 3000/tcp

# 开放 Nginx
sudo ufw allow 'Nginx Full'

# 启用防火墙
sudo ufw enable
```

### Firewalld (CentOS)

```bash
# 开放端口
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# 重载防火墙
sudo firewall-cmd --reload
```

## 目标服务器准备

在部署 Soga 之前，确保目标服务器满足以下条件：

### 1. 开放 SSH 访问

编辑 `/etc/ssh/sshd_config`：

```bash
PermitRootLogin yes  # 允许 root 登录
PasswordAuthentication yes  # 允许密码认证（或使用密钥）
```

重启 SSH 服务：

```bash
sudo systemctl restart sshd
```

### 2. 安装必要工具

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install wget curl systemctl

# CentOS
sudo yum install wget curl
```

### 3. 开放节点端口

根据你的面板配置，开放相应的端口：

```bash
# 示例：开放常用端口
sudo ufw allow 443/tcp
sudo ufw allow 80/tcp
sudo ufw allow 8388/tcp
sudo ufw allow 12345/tcp

# 或使用 firewalld
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --reload
```

## 使用流程

### 1. 添加服务器

1. 点击"服务器管理"标签
2. 点击"添加服务器"按钮
3. 填写服务器信息：
   - 服务器名称：例如 "香港节点-01"
   - IP 地址：目标服务器的公网 IP
   - SSH 端口：默认 22
   - 用户名：通常为 root
   - 认证方式：选择密码或密钥
4. 点击"添加"按钮
5. 点击"测试连接"验证配置

### 2. 创建 Soga 实例

1. 点击"实例管理"标签
2. 点击"创建实例"按钮
3. 填写配置信息：
   - **目标服务器**：选择已添加的服务器
   - **实例名称**：例如 "node-hk-01"（用于 systemd 命名）
   - **面板类型**：根据你的面板选择
   - **面板地址**：完整的面板 URL
   - **面板密钥**：从面板获取的 muKey 或 Token
   - **节点 ID**：面板中对应的节点 ID
   - **证书配置**：如果需要 TLS，填写证书信息
   - **高级配置**：根据需要调整
   - **路由配置**：可选，自定义路由规则
   - **黑名单**：可选，屏蔽特定域名或 IP
4. 点击"创建实例"
5. 等待安装完成（通常 1-2 分钟）

### 3. 管理实例

在实例列表中，每个实例卡片提供以下操作：

- **启动**：启动 Soga 服务
- **停止**：停止 Soga 服务
- **重启**：重启 Soga 服务
- **日志**：查看实例运行日志
- **删除**：删除实例（停止服务并删除所有文件）

## 故障排查

### 无法连接面板

**问题**：面板无法访问

**解决方案**：
1. 检查 Node.js 服务是否运行：`pm2 status`
2. 检查端口占用：`netstat -tlnp | grep 3000`
3. 检查防火墙规则
4. 查看日志：`pm2 logs soga-panel`

### SSH 连接失败

**问题**：添加服务器时提示连接失败

**解决方案**：
1. 验证服务器 IP 是否正确
2. 检查 SSH 端口（默认 22）
3. 验证用户名和密码
4. 确认目标服务器 SSH 服务运行正常
5. 检查网络连通性：`ping 目标IP`
6. 查看目标服务器防火墙规则

### Soga 安装失败

**问题**：创建实例时安装失败

**解决方案**：
1. 检查目标服务器网络连接
2. 验证目标服务器能访问 GitHub
3. 检查磁盘空间：`df -h`
4. 查看面板日志获取详细错误
5. 手动测试下载：`wget https://github.com/sprov065/soga/releases/latest/download/soga-linux-amd64`

### Soga 服务启动失败

**问题**：实例显示已停止状态

**解决方案**：
1. 点击"日志"按钮查看详细错误
2. 验证面板地址是否正确
3. 检查面板密钥是否有效
4. 确认节点 ID 是否存在
5. 在目标服务器手动检查：
   ```bash
   systemctl status soga-{实例名称}
   journalctl -u soga-{实例名称} -n 50
   ```

### 节点无法连接面板

**问题**：Soga 运行但节点离线

**解决方案**：
1. 检查面板地址格式：必须包含 http:// 或 https://
2. 验证节点 ID 在面板中是否存在
3. 检查面板密钥是否正确
4. 确认目标服务器能访问面板地址：
   ```bash
   curl -I https://panel.example.com
   ```
5. 查看 Soga 日志排查详细错误

## 安全建议

1. **修改默认端口**
   ```javascript
   // 编辑 server/app.js
   const PORT = process.env.PORT || 8080;  // 改为其他端口
   ```

2. **使用 SSH 密钥认证**
   - 在目标服务器上禁用密码认证
   - 使用 SSH 密钥对进行认证
   - 定期轮换密钥

3. **限制访问 IP**
   ```nginx
   # Nginx 配置
   location / {
       allow 1.2.3.4;  # 你的 IP
       deny all;
       proxy_pass http://127.0.0.1:3000;
   }
   ```

4. **定期更新**
   - 定期更新 Soga 版本
   - 更新 Node.js 依赖
   - 及时打补丁

5. **备份数据**
   ```bash
   # 备份配置文件
   cp data/servers.json data/servers.json.backup
   ```

## 维护任务

### 更新 Soga 版本

面板会自动下载最新版本，手动更新步骤：

1. 停止实例
2. 删除实例
3. 重新创建实例（会下载最新版）

### 备份配置

```bash
# 备份数据目录
tar -czf soga-panel-backup-$(date +%Y%m%d).tar.gz data/

# 恢复
tar -xzf soga-panel-backup-20240101.tar.gz
```

### 清理日志

```bash
# 清理 PM2 日志
pm2 flush

# 清理系统日志
sudo journalctl --vacuum-time=7d
```

## 性能优化

### 增加 Node.js 内存限制

```bash
# PM2 启动时指定内存
pm2 start server/app.js --name soga-panel --max-memory-restart 1G
```

### 启用 Nginx 缓存

```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m;

location / {
    proxy_cache my_cache;
    proxy_pass http://127.0.0.1:3000;
}
```

## 常见问题

**Q: 支持哪些面板？**
A: 支持 SSPanel、V2board、ProxyPanel、SSPanel-UIM 等主流面板

**Q: 可以同时管理多少台服务器？**
A: 理论上无限制，取决于面板服务器性能

**Q: 一台服务器可以运行多个 Soga 实例吗？**
A: 可以，每个实例使用独立的 systemd 服务和配置目录

**Q: 如何查看 Soga 版本？**
A: 在目标服务器执行：`/etc/soga/{实例名称}/soga -v`

**Q: 支持 Windows 服务器吗？**
A: 目前只支持 Linux 服务器作为 Soga 运行环境

**Q: 如何修改实例配置？**
A: 目前需要删除重建，后续版本将支持在线编辑

## 技术支持

遇到问题请：
1. 查看本文档的故障排查部分
2. 检查日志文件
3. 提交 Issue 并附上详细日志

## 更新日志

### v1.0.0 (2024-01-01)
- 初始版本发布
- 支持基本的服务器管理
- 支持 Soga 实例的创建、启动、停止、重启
- 支持配置文件自定义
- 支持日志查看
