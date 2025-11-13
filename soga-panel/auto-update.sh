#!/bin/bash

# Soga Panel 一键自动更新脚本
# 无需交互，直接从 GitHub 拉取最新代码

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# GitHub 仓库配置（请修改为你的仓库地址）
GITHUB_REPO="${GITHUB_REPO:-gkd-cloud/gkdcloud}"
BRANCH="${BRANCH:-main}"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Soga Panel 一键自动更新${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}错误: 请在 soga-panel 目录下运行此脚本${NC}"
    exit 1
fi

# 获取当前版本
CURRENT_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
echo -e "${YELLOW}当前版本: v${CURRENT_VERSION}${NC}"
echo ""

# 1. 备份当前版本
echo -e "${BLUE}[1/7]${NC} 备份当前版本..."
BACKUP_DIR="../soga-panel-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 备份关键文件和数据
if [ -d "data" ]; then
    cp -r data "$BACKUP_DIR/" 2>/dev/null && echo -e "  ${GREEN}✓${NC} 已备份 data 目录"
fi
if [ -f "package.json" ]; then
    cp package.json "$BACKUP_DIR/" 2>/dev/null && echo -e "  ${GREEN}✓${NC} 已备份 package.json"
fi

echo -e "${GREEN}✓ 备份完成: ${BACKUP_DIR}${NC}"
echo ""

# 2. 检查 git 状态
echo -e "${BLUE}[2/7]${NC} 检查更新..."

# 添加当前目录为 Git 安全目录（解决 Git 2.35.2+ 的所有权检查问题）
CURRENT_DIR=$(pwd)
git config --global --add safe.directory "$CURRENT_DIR" 2>/dev/null || true

if [ ! -d ".git" ]; then
    # 如果不是 git 仓库，初始化并添加远程仓库
    echo -e "${YELLOW}  初始化 Git 仓库...${NC}"
    git init
fi

# 确保 remote origin 正确配置
if ! git remote get-url origin &>/dev/null; then
    echo -e "${YELLOW}  添加远程仓库...${NC}"
    git remote add origin "https://github.com/${GITHUB_REPO}.git"
else
    # remote 存在，确保 URL 正确
    git remote set-url origin "https://github.com/${GITHUB_REPO}.git"
fi

# 保存本地修改
git add .
git stash save "auto-backup-$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true

echo -e "${GREEN}✓ 准备就绪${NC}"
echo ""

# 3. 拉取最新代码
echo -e "${BLUE}[3/7]${NC} 拉取最新代码..."
git fetch origin "$BRANCH" --depth=1

# 检查是否有更新
LOCAL_HASH=$(git rev-parse HEAD 2>/dev/null || echo "none")
REMOTE_HASH=$(git rev-parse origin/$BRANCH 2>/dev/null || echo "none")

if [ "$LOCAL_HASH" = "$REMOTE_HASH" ]; then
    echo -e "${GREEN}✓ 已是最新版本，无需更新${NC}"
    echo ""
    # 恢复 stash（如果有）
    git stash pop 2>/dev/null || true
    exit 0
fi

# 拉取最新代码到临时目录
TEMP_DIR=$(mktemp -d)
git clone --branch "$BRANCH" --depth=1 "https://github.com/${GITHUB_REPO}.git" "$TEMP_DIR" 2>/dev/null || {
    echo -e "${RED}✗ 拉取代码失败${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
}

# 检查是否 soga-panel 在子目录中
if [ -d "$TEMP_DIR/soga-panel" ]; then
    echo -e "${YELLOW}  检测到 soga-panel 子目录，正在同步...${NC}"
    SOURCE_DIR="$TEMP_DIR/soga-panel"
else
    SOURCE_DIR="$TEMP_DIR"
fi

# 同步代码（排除 data 目录和 node_modules）
rsync -av --exclude='data' --exclude='node_modules' --exclude='.git' "$SOURCE_DIR/" ./ 2>/dev/null || {
    # 如果 rsync 不可用，使用 cp
    find "$SOURCE_DIR" -mindepth 1 -maxdepth 1 ! -name 'data' ! -name 'node_modules' ! -name '.git' -exec cp -r {} ./ \; 2>/dev/null
}

# 清理临时目录
rm -rf "$TEMP_DIR"

# 恢复数据目录
if [ -d "$BACKUP_DIR/data" ]; then
    rm -rf data
    cp -r "$BACKUP_DIR/data" .
    echo -e "  ${GREEN}✓${NC} 已恢复 data 目录"
fi

echo -e "${GREEN}✓ 代码更新完成${NC}"
echo ""

# 4. 停止服务
echo -e "${BLUE}[4/7]${NC} 停止服务..."
if command -v pm2 &> /dev/null; then
    pm2 stop soga-panel 2>/dev/null && echo -e "  ${GREEN}✓${NC} PM2 服务已停止" || echo -e "  ${YELLOW}⚠${NC} PM2 服务未运行"
else
    pkill -f "node server/app.js" 2>/dev/null && echo -e "  ${GREEN}✓${NC} Node 进程已停止" || echo -e "  ${YELLOW}⚠${NC} 服务未运行"
fi
echo -e "${GREEN}✓ 服务停止完成${NC}"
echo ""

# 5. 清理旧依赖
echo -e "${BLUE}[5/7]${NC} 清理旧依赖..."
rm -rf node_modules package-lock.json
echo -e "${GREEN}✓ 清理完成${NC}"
echo ""

# 6. 安装依赖
echo -e "${BLUE}[6/7]${NC} 安装依赖..."
echo -e "${YELLOW}  使用 --ignore-scripts 参数安装...${NC}"

if npm install --ignore-scripts 2>/dev/null; then
    echo -e "${GREEN}✓ 依赖安装完成${NC}"
else
    echo -e "${YELLOW}  尝试使用国内镜像...${NC}"
    if npm install --registry=https://registry.npmmirror.com --ignore-scripts; then
        echo -e "${GREEN}✓ 依赖安装完成（使用国内镜像）${NC}"
    else
        echo -e "${RED}✗ 依赖安装失败${NC}"
        echo ""
        echo -e "${YELLOW}正在恢复备份...${NC}"
        if [ -d "$BACKUP_DIR/data" ]; then
            cp -r "$BACKUP_DIR/data" ./
        fi
        echo -e "${RED}请手动检查并修复问题后重试${NC}"
        exit 1
    fi
fi
echo ""

# 7. 重启服务
echo -e "${BLUE}[7/7]${NC} 重启服务..."

# 先测试启动
echo -e "${YELLOW}  测试启动...${NC}"
timeout 5 node server/app.js &> /dev/null &
TEST_PID=$!
sleep 3

if ps -p $TEST_PID > /dev/null 2>&1; then
    kill $TEST_PID 2>/dev/null || true
    echo -e "  ${GREEN}✓${NC} 服务测试通过"

    # 正式启动
    if command -v pm2 &> /dev/null; then
        pm2 start server/app.js --name soga-panel 2>/dev/null || pm2 restart soga-panel
        echo -e "  ${GREEN}✓${NC} PM2 服务已启动"
    else
        nohup npm start > soga-panel.log 2>&1 &
        echo -e "  ${GREEN}✓${NC} 服务已在后台启动（nohup）"
    fi
else
    echo -e "${RED}✗ 服务启动测试失败${NC}"
    echo ""
    echo -e "${YELLOW}正在恢复备份...${NC}"
    if [ -d "$BACKUP_DIR/data" ]; then
        cp -r "$BACKUP_DIR/data" ./
    fi
    echo -e "${RED}请运行以下命令查看错误：${NC}"
    echo -e "  ${YELLOW}node server/app.js${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 服务启动完成${NC}"
echo ""

# 获取新版本号
NEW_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")

# 显示更新结果
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✓ 更新成功！${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}版本信息:${NC}"
echo -e "  旧版本: ${YELLOW}v${CURRENT_VERSION}${NC}"
echo -e "  新版本: ${GREEN}v${NEW_VERSION}${NC}"
echo ""
echo -e "${BLUE}备份位置:${NC}"
echo -e "  ${BACKUP_DIR}"
echo ""
echo -e "${BLUE}服务管理:${NC}"
if command -v pm2 &> /dev/null; then
    echo -e "  查看状态: ${YELLOW}pm2 status${NC}"
    echo -e "  查看日志: ${YELLOW}pm2 logs soga-panel${NC}"
    echo -e "  重启服务: ${YELLOW}pm2 restart soga-panel${NC}"
else
    echo -e "  查看日志: ${YELLOW}tail -f soga-panel.log${NC}"
    echo -e "  重启服务: ${YELLOW}./auto-update.sh${NC}"
fi
echo ""
echo -e "${BLUE}访问地址:${NC}"
echo -e "  ${GREEN}http://localhost:3000${NC}"
echo ""
echo -e "${BLUE}如遇问题恢复备份:${NC}"
echo -e "  ${YELLOW}cp -r ${BACKUP_DIR}/data ./${NC}"
echo ""
