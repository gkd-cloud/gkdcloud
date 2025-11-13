# 快速开始指南

## 问题排查

如果遇到 `Cannot find module '/root/soga-panel/server/app.js'` 错误，说明文件没有正确解压。

## 完整部署步骤

### 1. 下载并解压

```bash
# 解压项目
tar -xzf soga-panel.tar.gz

# 进入目录
cd soga-panel

# 检查文件是否完整
ls -la server/
```

你应该看到：
```
server/
├── app.js
├── routes/
│   ├── server.js
│   └── soga.js
├── services/
│   ├── ssh.js
│   └── soga-installer.js
└── utils/
    └── config-generator.js
```

### 2. 一键部署（推荐）

```bash
chmod +x deploy.sh
./deploy.sh
```

这个脚本会自动：
- 检查 Node.js 环境
- 检查项目文件完整性
- 清理旧依赖
- 安装新依赖
- 初始化数据目录
- 测试服务启动

### 3. 手动部署

如果一键脚本失败，可以手动执行：

```bash
# 检查文件
bash check.sh

# 清理
rm -rf node_modules package-lock.json

# 安装依赖（关键：使用 --ignore-scripts）
npm install --ignore-scripts

# 或使用国内镜像
npm install --registry=https://registry.npmmirror.com --ignore-scripts

# 创建数据文件
mkdir -p data
echo '{"servers":[],"instances":[]}' > data/servers.json

# 启动服务
npm start
```

### 4. 启动服务

**前台运行（测试用）：**
```bash
npm start
```

**后台运行（PM2，推荐）：**
```bash
# 安装 PM2
npm install -g pm2

# 启动
pm2 start server/app.js --name soga-panel

# 查看状态
pm2 status

# 查看日志
pm2 logs soga-panel

# 设置开机自启
pm2 startup
pm2 save
```

**后台运行（nohup）：**
```bash
nohup npm start > soga-panel.log 2>&1 &

# 查看日志
tail -f soga-panel.log
```

### 5. 访问面板

浏览器打开：
```
http://localhost:3000
或
http://你的服务器IP:3000
```

## 常见问题

### Q1: 找不到 server/app.js

**原因：** 解压不完整或在错误的目录

**解决：**
```bash
# 重新解压
rm -rf soga-panel
tar -xzf soga-panel.tar.gz
cd soga-panel

# 检查文件
bash check.sh
```

### Q2: npm install 失败

**原因：** ssh2 模块的 install.js 脚本问题

**解决：** 必须使用 `--ignore-scripts` 参数
```bash
npm install --ignore-scripts
```

### Q3: 端口被占用

**错误：** `EADDRINUSE: address already in use :::3000`

**解决：**
```bash
# 方法 1: 找到并杀死占用进程
lsof -i :3000
kill -9 <PID>

# 方法 2: 使用其他端口
PORT=8080 npm start
```

### Q4: 无法访问面板

**检查清单：**
1. 服务是否运行：`ps aux | grep node`
2. 端口是否监听：`netstat -tlnp | grep 3000`
3. 防火墙是否开放：
   ```bash
   # UFW
   sudo ufw allow 3000
   
   # Firewalld
   sudo firewall-cmd --permanent --add-port=3000/tcp
   sudo firewall-cmd --reload
   ```
4. 如果是云服务器，检查安全组规则

### Q5: Node.js 版本过低

**检查版本：**
```bash
node -v  # 需要 >= 14.0
```

**升级 Node.js：**

Ubuntu/Debian:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

CentOS:
```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

使用 nvm（推荐）:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
```

## 目录结构

```
soga-panel/
├── server/              # 后端代码
│   ├── app.js          # 主程序
│   ├── routes/         # API 路由
│   ├── services/       # 业务逻辑
│   └── utils/          # 工具函数
├── public/             # 前端代码
│   ├── index.html
│   ├── css/
│   └── js/
├── config-templates/   # 配置模板
├── data/               # 数据存储
│   └── servers.json    # 服务器配置
├── package.json        # 依赖配置
├── deploy.sh          # 一键部署脚本
├── check.sh           # 文件检查脚本
├── install.sh         # 依赖安装脚本
└── README.md          # 完整文档
```

## 验证部署

部署成功后，执行以下命令验证：

```bash
# 1. 检查服务运行
pm2 status
# 或
ps aux | grep node

# 2. 测试 API
curl http://localhost:3000/api/health

# 应该返回：
# {"status":"ok","timestamp":"..."}

# 3. 检查数据文件
cat data/servers.json

# 应该看到：
# {"servers":[],"instances":[]}
```

## 下一步

1. 打开浏览器访问面板
2. 添加第一台服务器
3. 创建第一个 Soga 实例
4. 查看实例状态和日志

## 获取帮助

- 查看完整文档：`cat README.md`
- 查看 API 文档：`cat API.md`
- 查看部署文档：`cat DEPLOYMENT.md`
- 查看故障排查：`cat TROUBLESHOOTING.md`

## 安全提醒

1. 修改默认端口 3000
2. 配置防火墙规则
3. 使用 Nginx 反向代理
4. 启用 HTTPS
5. 定期备份 data/servers.json
