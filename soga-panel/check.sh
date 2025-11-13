#!/bin/bash

# 部署前检查脚本

echo "================================"
echo "Soga Panel 部署前检查"
echo "================================"
echo ""

# 检查必要文件
echo "检查项目文件..."

required_files=(
    "server/app.js"
    "server/routes/server.js"
    "server/routes/soga.js"
    "server/services/ssh.js"
    "server/services/soga-installer.js"
    "server/utils/config-generator.js"
    "public/index.html"
    "public/css/style.css"
    "public/js/main.js"
    "package.json"
)

missing_files=0

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "✗ 缺少文件: $file"
        missing_files=$((missing_files + 1))
    else
        echo "✓ $file"
    fi
done

echo ""

if [ $missing_files -gt 0 ]; then
    echo "================================"
    echo "✗ 发现 $missing_files 个文件缺失"
    echo "================================"
    echo ""
    echo "请重新解压项目文件："
    echo "  tar -xzf soga-panel.tar.gz"
    echo ""
    exit 1
else
    echo "================================"
    echo "✓ 所有文件检查通过"
    echo "================================"
    echo ""
    echo "现在可以安装依赖："
    echo "  ./install.sh"
    echo "或"
    echo "  npm install --ignore-scripts"
    echo ""
fi
