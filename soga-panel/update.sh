#!/bin/bash

# Soga Panel 一键更新脚本

set -e

echo "================================"
echo "Soga Panel 一键更新脚本"
echo "================================"
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "错误: 请在 soga-panel 目录下运行此脚本"
    exit 1
fi

# 获取当前版本
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "当前版本: v${CURRENT_VERSION}"
echo ""

# 选择更新方式
echo "请选择更新方式:"
echo "1. 从 GitHub 自动下载最新版本（推荐）"
echo "2. 使用本地 soga-panel.tar.gz 文件"
echo ""
read -p "请选择 (1/2): " UPDATE_METHOD

if [ "$UPDATE_METHOD" = "1" ]; then
    # 从 GitHub 下载
    echo ""
    read -p "输入 GitHub 仓库 (格式: username/repo): " GITHUB_REPO
    
    if [ -z "$GITHUB_REPO" ]; then
        echo "错误: 仓库地址不能为空"
        exit 1
    fi
    
    echo ""
    echo "获取最新版本信息..."
    
    # 获取最新版本
    LATEST_VERSION=$(curl -s "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')
    
    if [ -z "$LATEST_VERSION" ]; then
        echo "错误: 无法获取最新版本信息"
        echo "请检查仓库地址是否正确: ${GITHUB_REPO}"
        exit 1
    fi
    
    echo "最新版本: v${LATEST_VERSION}"
    
    if [ "$LATEST_VERSION" = "$CURRENT_VERSION" ]; then
        echo ""
        echo "✓ 已是最新版本，无需更新"
        exit 0
    fi
    
    echo ""
    read -p "确认更新到 v${LATEST_VERSION}? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "已取消"
        exit 0
    fi
    
    echo ""
    echo "下载最新版本..."
    DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/download/v${LATEST_VERSION}/soga-panel-v${LATEST_VERSION}.tar.gz"
    
    wget -O soga-panel-new.tar.gz "$DOWNLOAD_URL"
    
    if [ $? -ne 0 ]; then
        echo "错误: 下载失败"
        rm -f soga-panel-new.tar.gz
        exit 1
    fi
    
    PACKAGE_FILE="soga-panel-new.tar.gz"
    
elif [ "$UPDATE_METHOD" = "2" ]; then
    # 使用本地文件
    if [ ! -f "soga-panel.tar.gz" ]; then
        echo "错误: 未找到 soga-panel.tar.gz"
        echo "请先下载最新版本到当前目录"
        exit 1
    fi
    PACKAGE_FILE="soga-panel.tar.gz"
else
    echo "无效的选择"
    exit 1
fi

echo ""

# 备份当前版本
echo "1. 备份当前版本..."
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "../${BACKUP_DIR}"

# 备份数据和配置
cp -r data "../${BACKUP_DIR}/" 2>/dev/null || echo "  (跳过 data 目录)"
cp package.json "../${BACKUP_DIR}/" 2>/dev/null || echo "  (跳过 package.json)"

echo "✓ 备份完成: ../${BACKUP_DIR}"
echo ""

# 停止服务
echo "2. 停止服务..."
if command -v pm2 &> /dev/null; then
    pm2 stop soga-panel 2>/dev/null || echo "  (PM2 服务未运行)"
else
    pkill -f "node server/app.js" 2>/dev/null || echo "  (服务未运行)"
fi
echo "✓ 服务已停止"
echo ""

# 解压新版本
echo "3. 解压新版本..."
tar -xzf "$PACKAGE_FILE" --strip-components=1 -C . \
    --exclude='data' \
    --exclude='node_modules'
echo "✓ 解压完成（已保留 data 目录）"
echo ""

# 清理下载文件
if [ "$UPDATE_METHOD" = "1" ]; then
    rm -f soga-panel-new.tar.gz
fi

# 安装依赖
echo "4. 更新依赖..."
rm -rf node_modules package-lock.json
npm install --ignore-scripts

if [ $? -ne 0 ]; then
    echo "✗ 依赖安装失败"
    echo "尝试使用国内镜像..."
    npm install --registry=https://registry.npmmirror.com --ignore-scripts
fi
echo "✓ 依赖更新完成"
echo ""

# 运行前端更新脚本（如果存在）
if [ -f "update-frontend.sh" ]; then
    echo "5. 更新前端文件..."
    bash update-frontend.sh
    echo ""
fi

# 测试启动
echo "6. 测试启动..."
timeout 5 node server/app.js &> /dev/null &
PID=$!
sleep 3

if ps -p $PID > /dev/null; then
    kill $PID
    echo "✓ 服务测试通过"
else
    echo "✗ 服务启动失败"
    echo ""
    echo "正在恢复备份..."
    cp -r "../${BACKUP_DIR}/data" ./ 2>/dev/null || true
    echo "请检查错误日志: node server/app.js"
    exit 1
fi
echo ""

# 重启服务
echo "7. 重启服务..."
if command -v pm2 &> /dev/null; then
    pm2 start server/app.js --name soga-panel 2>/dev/null || pm2 restart soga-panel
    echo "✓ PM2 服务已启动"
else
    nohup npm start > soga-panel.log 2>&1 &
    echo "✓ 服务已在后台启动"
fi
echo ""

# 获取新版本号
NEW_VERSION=$(node -p "require('./package.json').version")

echo "================================"
echo "✓ 更新完成！"
echo "================================"
echo ""
echo "版本: v${CURRENT_VERSION} -> v${NEW_VERSION}"
echo "备份位置: ../${BACKUP_DIR}"
echo ""
echo "如果遇到问题，可以恢复备份："
echo "  cp -r ../${BACKUP_DIR}/data ./"
echo ""
echo "查看服务状态："
echo "  pm2 status         # PM2 方式"
echo "  tail -f soga-panel.log  # nohup 方式"
echo ""
echo "访问地址:"
echo "  http://localhost:3000"
echo ""
