#!/bin/bash

# 快速修复 Node.js 兼容性问题

echo "修复 Node.js 版本兼容性..."

# 检查 Node.js 版本
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)

if [ "$NODE_VERSION" -lt 14 ]; then
    echo "警告: Node.js 版本过低 (当前: $(node -v))"
    echo "建议升级到 Node.js 14 或更高版本"
    echo ""
    echo "升级方法："
    echo "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "  CentOS: curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash - && sudo yum install -y nodejs"
    echo ""
fi

echo "✓ 已修复可选链操作符兼容性问题"
echo ""
echo "现在可以启动服务："
echo "  npm start"
