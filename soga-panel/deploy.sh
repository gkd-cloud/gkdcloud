#!/bin/bash

# Soga Panel 完整部署脚本

set -e  # 遇到错误立即退出

echo "================================"
echo "Soga Panel 完整部署脚本"
echo "================================"
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "错误: 请在 soga-panel 目录下运行此脚本"
    exit 1
fi

# 检查 Node.js
echo "1. 检查 Node.js 环境..."
if ! command -v node &> /dev/null; then
    echo "✗ 未检测到 Node.js"
    echo ""
    echo "请先安装 Node.js (版本 >= 14.0):"
    echo "Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "CentOS: curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash - && sudo yum install -y nodejs"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✓ Node.js 版本: $NODE_VERSION"
echo "✓ NPM 版本: $(npm -v)"
echo ""

# 检查必要文件
echo "2. 检查项目文件..."
required_files=(
    "server/app.js"
    "server/routes/server.js"
    "server/routes/soga.js"
    "server/services/ssh.js"
    "server/services/soga-installer.js"
    "server/utils/config-generator.js"
)

missing=0
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "✗ 缺少: $file"
        missing=1
    fi
done

if [ $missing -eq 1 ]; then
    echo ""
    echo "错误: 发现文件缺失，请重新解压项目"
    exit 1
fi

echo "✓ 所有必要文件完整"
echo ""

# 清理旧依赖
echo "3. 清理旧依赖..."
rm -rf node_modules package-lock.json
echo "✓ 清理完成"
echo ""

# 安装依赖
echo "4. 安装依赖包..."
echo "   使用 --ignore-scripts 参数避免安装脚本错误..."
npm install --ignore-scripts

if [ $? -ne 0 ]; then
    echo ""
    echo "✗ 依赖安装失败"
    echo ""
    echo "尝试使用国内镜像："
    npm install --registry=https://registry.npmmirror.com --ignore-scripts
    
    if [ $? -ne 0 ]; then
        echo ""
        echo "依赖安装失败，请检查网络连接或手动安装："
        echo "  npm install express@^4.18.2"
        echo "  npm install ssh2-promise@^1.0.3 --ignore-scripts"
        echo "  npm install body-parser@^1.20.2"
        echo "  npm install cors@^2.8.5"
        exit 1
    fi
fi

echo "✓ 依赖安装成功"
echo ""

# 创建数据目录
echo "5. 初始化数据目录..."
mkdir -p data
if [ ! -f "data/servers.json" ]; then
    echo '{"servers":[],"instances":[]}' > data/servers.json
    echo "✓ 创建数据文件"
fi
echo ""

# 测试启动
echo "6. 测试服务启动..."
timeout 5 node server/app.js &> /dev/null &
PID=$!
sleep 3

if ps -p $PID > /dev/null; then
    kill $PID
    echo "✓ 服务启动测试通过"
else
    echo "✗ 服务启动失败"
    echo ""
    echo "请检查错误日志："
    echo "  node server/app.js"
    exit 1
fi
echo ""

echo "================================"
echo "✓ 部署成功！"
echo "================================"
echo ""
echo "启动方式："
echo ""
echo "1. 前台运行（用于测试）："
echo "   npm start"
echo ""
echo "2. 后台运行（使用 PM2，推荐）："
echo "   npm install -g pm2"
echo "   pm2 start server/app.js --name soga-panel"
echo "   pm2 startup"
echo "   pm2 save"
echo ""
echo "3. 后台运行（使用 nohup）："
echo "   nohup npm start > soga-panel.log 2>&1 &"
echo ""
echo "访问地址："
echo "   http://localhost:3000"
echo "   http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "查看日志："
echo "   tail -f soga-panel.log    # nohup 方式"
echo "   pm2 logs soga-panel       # PM2 方式"
echo ""
