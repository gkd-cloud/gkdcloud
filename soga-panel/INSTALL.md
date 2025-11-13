# 快速安装指南

## 针对 npm install 错误的解决方案

如果您遇到 `Error: Cannot find module '/root/soga-panel/node_modules/ssh2/install.js'` 错误，请按以下步骤操作：

## 解决方案 1: 使用安装脚本（推荐）

```bash
cd soga-panel
chmod +x install.sh
./install.sh
```

安装脚本会自动：
- 检查 Node.js 版本
- 清理旧的依赖
- 使用正确的参数安装依赖
- 提供详细的安装日志

## 解决方案 2: 手动清理并重装

```bash
cd soga-panel

# 1. 删除旧的依赖
rm -rf node_modules package-lock.json

# 2. 使用 legacy-peer-deps 参数安装
npm install --legacy-peer-deps
```

## 解决方案 3: 使用国内镜像

如果网络较慢或无法访问 npm 官方源：

```bash
cd soga-panel

# 1. 清理
rm -rf node_modules package-lock.json

# 2. 使用淘宝镜像
npm install --registry=https://registry.npmmirror.com --legacy-peer-deps
```

## 解决方案 4: 逐个安装依赖

如果上述方法都失败，可以手动安装每个依赖：

```bash
cd soga-panel

# 清理
rm -rf node_modules package-lock.json

# 逐个安装
npm install express@^4.18.2 --save
npm install node-ssh@^12.0.5 --save
npm install body-parser@^1.20.2 --save
npm install cors@^2.8.5 --save
npm install nodemon@^2.0.22 --save-dev
```

## 验证安装

安装成功后，运行以下命令验证：

```bash
# 检查依赖是否安装
ls node_modules

# 启动服务测试
npm start
```

如果看到以下输出，说明安装成功：

```
=================================
Soga Panel 已启动
访问地址: http://localhost:3000
API 地址: http://localhost:3000/api
=================================
```

## 常见问题

### Q: 为什么需要 --legacy-peer-deps 参数？

A: 由于 node-ssh 依赖的 ssh2 模块版本兼容性问题，需要使用此参数来忽略 peer 依赖警告。

### Q: 安装需要多长时间？

A: 通常 1-3 分钟，取决于网络速度。

### Q: Node.js 版本要求是什么？

A: Node.js >= 14.0，推荐使用 16.x 或 18.x LTS 版本。

检查版本：
```bash
node -v
npm -v
```

### Q: 如何更新 Node.js？

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**CentOS:**
```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

**使用 nvm（推荐）:**
```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# 安装 Node.js 18
nvm install 18
nvm use 18
```

## 完整安装流程示例

```bash
# 1. 解压项目
tar -xzf soga-panel.tar.gz
cd soga-panel

# 2. 运行安装脚本
chmod +x install.sh
./install.sh

# 3. 启动服务
npm start

# 4. 浏览器访问
# http://localhost:3000
```

## 后台运行（推荐使用 PM2）

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start server/app.js --name soga-panel

# 查看状态
pm2 status

# 查看日志
pm2 logs soga-panel

# 设置开机自启
pm2 startup
pm2 save
```

## 仍然遇到问题？

请查看详细的 [故障排查文档](TROUBLESHOOTING.md)，其中包含：
- 所有常见错误及解决方案
- 网络问题处理
- 权限问题处理
- SSH 连接问题
- 系统兼容性问题

或者直接查看日志获取更多信息：
```bash
npm start 2>&1 | tee install.log
```
