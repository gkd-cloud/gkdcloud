#!/bin/bash

# Soga Panel 安装脚本

echo "================================"
echo "Soga Panel 安装脚本"
echo "================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未检测到 Node.js"
    echo "请先安装 Node.js (版本 >= 14.0)"
    echo ""
    echo "安装方法:"
    echo "Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "CentOS: curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash - && sudo yum install -y nodejs"
    exit 1
fi

echo "✓ Node.js 版本: $(node -v)"
echo "✓ NPM 版本: $(npm -v)"
echo ""

# 清理旧的依赖
echo "清理旧的依赖..."
rm -rf node_modules package-lock.json
echo "✓ 清理完成"
echo ""

# 安装依赖
echo "安装依赖包..."
echo "使用 ssh2-promise 库，避免编译问题..."
npm install --ignore-scripts

if [ $? -eq 0 ]; then
    echo ""
    echo "================================"
    echo "✓ 安装成功！"
    echo "================================"
    echo ""
    echo "启动命令:"
    echo "  npm start          # 直接启动"
    echo "  pm2 start server/app.js --name soga-panel  # 后台运行"
    echo ""
    echo "访问地址:"
    echo "  http://localhost:3000"
    echo ""
else
    echo ""
    echo "================================"
    echo "✗ 安装失败"
    echo "================================"
    echo ""
    echo "请尝试以下解决方案:"
    echo "1. 删除 node_modules 和 package-lock.json"
    echo "   rm -rf node_modules package-lock.json"
    echo ""
    echo "2. 使用国内镜像重新安装:"
    echo "   npm install --registry=https://registry.npmmirror.com"
    echo ""
    echo "3. 或者手动安装依赖:"
    echo "   npm install --ignore-scripts"
    echo "   或者逐个安装:"
    echo "   npm install express@^4.18.2"
    echo "   npm install ssh2-promise@^1.0.3 --ignore-scripts"
    echo "   npm install body-parser@^1.20.2"
    echo "   npm install cors@^2.8.5"
    echo ""
    exit 1
fi
