# 故障排查指南

## 常见安装问题

### 问题 1: npm install 失败 - ssh2 模块错误

**错误信息:**
```
Error: Cannot find module '/root/soga-panel/node_modules/ssh2/install.js'
```

**解决方案 1 - 使用安装脚本（推荐）:**
```bash
chmod +x install.sh
./install.sh
```

**解决方案 2 - 清理后重新安装:**
```bash
# 删除旧的依赖
rm -rf node_modules package-lock.json

# 使用 legacy-peer-deps 重新安装
npm install --legacy-peer-deps
```

**解决方案 3 - 使用国内镜像:**
```bash
# 清理
rm -rf node_modules package-lock.json

# 使用淘宝镜像
npm install --registry=https://registry.npmmirror.com --legacy-peer-deps
```

**解决方案 4 - 手动安装依赖:**
```bash
# 清理
rm -rf node_modules package-lock.json

# 手动安装每个依赖
npm install express@^4.18.2 --save
npm install node-ssh@^12.0.5 --save
npm install body-parser@^1.20.2 --save
npm install cors@^2.8.5 --save
npm install nodemon@^2.0.22 --save-dev
```

### 问题 2: Node.js 版本过低

**错误信息:**
```
Error: This version of Node.js requires a more recent version
```

**解决方案:**

Ubuntu/Debian:
```bash
# 安装 Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证版本
node -v
npm -v
```

CentOS:
```bash
# 安装 Node.js 18.x
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 验证版本
node -v
npm -v
```

使用 nvm（推荐）:
```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 重新加载配置
source ~/.bashrc

# 安装 Node.js 18
nvm install 18
nvm use 18

# 验证版本
node -v
npm -v
```

### 问题 3: 权限问题

**错误信息:**
```
EACCES: permission denied
```

**解决方案:**

方法 1 - 使用 sudo:
```bash
sudo npm install
```

方法 2 - 修改 npm 全局目录（推荐）:
```bash
# 创建 npm 全局目录
mkdir ~/.npm-global

# 配置 npm
npm config set prefix '~/.npm-global'

# 添加到 PATH
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# 重新安装
npm install
```

### 问题 4: 网络连接问题

**错误信息:**
```
npm ERR! network timeout
npm ERR! network request failed
```

**解决方案 1 - 使用国内镜像:**
```bash
# 永久配置
npm config set registry https://registry.npmmirror.com

# 临时使用
npm install --registry=https://registry.npmmirror.com
```

**解决方案 2 - 增加超时时间:**
```bash
npm install --timeout=60000
```

**解决方案 3 - 使用代理:**
```bash
# HTTP 代理
npm config set proxy http://127.0.0.1:7890
npm config set https-proxy http://127.0.0.1:7890

# 取消代理
npm config delete proxy
npm config delete https-proxy
```

## 运行时问题

### 问题 5: 端口被占用

**错误信息:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**解决方案:**

查找占用端口的进程:
```bash
# Linux
netstat -tlnp | grep 3000
lsof -i :3000

# 杀死进程
kill -9 <PID>
```

或修改默认端口:
```bash
# 使用环境变量
PORT=8080 npm start

# 或编辑 server/app.js
# 修改: const PORT = process.env.PORT || 3000;
# 为:   const PORT = process.env.PORT || 8080;
```

### 问题 6: 无法访问面板

**症状:** 浏览器无法打开 http://localhost:3000

**解决方案:**

1. 检查服务是否运行:
```bash
# 使用 PM2
pm2 status

# 直接运行
ps aux | grep node
```

2. 检查端口监听:
```bash
netstat -tlnp | grep 3000
```

3. 检查防火墙:
```bash
# UFW
sudo ufw status
sudo ufw allow 3000

# Firewalld
sudo firewall-cmd --list-ports
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

4. 如果是远程服务器，使用服务器 IP:
```
http://服务器IP:3000
```

### 问题 7: SSH 连接目标服务器失败

**错误信息:**
```
连接失败: Error: All configured authentication methods failed
```

**解决方案:**

1. 验证 SSH 连接:
```bash
ssh root@目标服务器IP
```

2. 检查 SSH 配置 `/etc/ssh/sshd_config`:
```bash
PermitRootLogin yes
PasswordAuthentication yes
```

3. 重启 SSH 服务:
```bash
sudo systemctl restart sshd
```

4. 使用 SSH 密钥认证（推荐）:
```bash
# 生成密钥对
ssh-keygen -t rsa -b 4096

# 复制公钥到目标服务器
ssh-copy-id root@目标服务器IP

# 在面板中使用私钥
cat ~/.ssh/id_rsa
```

### 问题 8: Soga 下载失败

**错误信息:**
```
下载失败: timeout
```

**解决方案:**

1. 在目标服务器测试网络:
```bash
# 测试 GitHub 连接
ping github.com
curl -I https://github.com

# 手动下载测试
wget https://github.com/sprov065/soga/releases/latest/download/soga-linux-amd64
```

2. 使用代理（如果目标服务器有代理）:
```bash
export http_proxy=http://127.0.0.1:7890
export https_proxy=http://127.0.0.1:7890
```

3. 使用镜像地址（需要修改代码）:
```javascript
// 在 server/services/soga-installer.js 中
// 修改 getDownloadUrl 方法，使用镜像地址
const baseUrl = 'https://mirror.ghproxy.com/https://github.com/sprov065/soga/releases';
```

### 问题 9: Soga 服务启动失败

**错误信息:**
```
服务启动失败
```

**解决方案:**

1. 查看详细日志:
```bash
# 在目标服务器
journalctl -u soga-{实例名称} -n 100
systemctl status soga-{实例名称}
```

2. 常见原因:
   - 面板地址错误
   - 面板密钥错误
   - 节点 ID 不存在
   - 端口被占用

3. 手动测试配置:
```bash
cd /etc/soga/{实例名称}
./soga -c soga.conf
```

### 问题 10: 数据丢失

**症状:** 服务器或实例列表为空

**解决方案:**

1. 检查数据文件:
```bash
cat data/servers.json
```

2. 恢复备份:
```bash
cp data/servers.json.backup data/servers.json
```

3. 重新创建数据文件:
```bash
echo '{"servers":[],"instances":[]}' > data/servers.json
```

## 性能问题

### 问题 11: 内存占用过高

**解决方案:**

使用 PM2 限制内存:
```bash
pm2 start server/app.js --name soga-panel --max-memory-restart 500M
```

### 问题 12: 响应速度慢

**解决方案:**

1. 检查目标服务器网络延迟:
```bash
ping 目标服务器IP
```

2. 增加 SSH 连接超时时间:
```javascript
// 在 server/services/ssh.js 中
// 修改 connect 方法，添加 readyTimeout
await this.ssh.connect({
  ...config,
  readyTimeout: 60000  // 增加到 60 秒
});
```

## 安全问题

### 问题 13: 数据文件暴露

**解决方案:**

1. 修改文件权限:
```bash
chmod 600 data/servers.json
```

2. 使用环境变量存储敏感信息:
```bash
# 创建 .env 文件
echo "ENCRYPTION_KEY=your-secret-key" > .env
chmod 600 .env
```

3. 启用 HTTPS（使用 Nginx）

## 获取帮助

如果以上方案都无法解决问题，请：

1. 查看完整日志:
```bash
# PM2 日志
pm2 logs soga-panel --lines 200

# 直接运行查看输出
npm start
```

2. 启用调试模式:
```bash
DEBUG=* npm start
```

3. 检查系统信息:
```bash
# Node.js 版本
node -v
npm -v

# 系统版本
cat /etc/os-release

# 内存和磁盘
free -h
df -h
```

4. 提供以下信息:
   - 错误信息截图
   - 完整日志
   - 系统环境（OS、Node.js 版本）
   - 操作步骤
