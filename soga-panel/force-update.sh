#!/bin/bash

# Soga Panel 强制更新脚本
# 用于强制同步最新代码，无需检查版本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# GitHub 仓库配置
GITHUB_REPO="${GITHUB_REPO:-gkd-cloud/gkdcloud}"
BRANCH="${BRANCH:-main}"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Soga Panel 强制更新${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}错误: 请在 soga-panel 目录下运行此脚本${NC}"
    exit 1
fi

# 1. 备份数据
echo -e "${BLUE}[1/4]${NC} 备份数据..."
if [ -d "data" ]; then
    BACKUP_DIR="/tmp/soga-panel-data-backup-$(date +%Y%m%d_%H%M%S)"
    cp -r data "$BACKUP_DIR"
    echo -e "  ${GREEN}✓${NC} 数据已备份到: $BACKUP_DIR"
else
    echo -e "  ${YELLOW}⚠${NC} 没有数据目录需要备份"
fi
echo -e "${GREEN}✓ 备份完成${NC}"
echo ""

# 2. 拉取最新代码
echo -e "${BLUE}[2/4]${NC} 拉取最新代码..."
TEMP_DIR=$(mktemp -d)

git clone --branch "$BRANCH" --depth=1 "https://github.com/${GITHUB_REPO}.git" "$TEMP_DIR" 2>&1 || {
    echo -e "${RED}✗ 拉取代码失败${NC}"
    echo -e "${YELLOW}请检查网络连接和仓库地址${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
}

# 检查是否 soga-panel 在子目录中
if [ -d "$TEMP_DIR/soga-panel" ]; then
    echo -e "${YELLOW}  检测到 soga-panel 子目录${NC}"
    SOURCE_DIR="$TEMP_DIR/soga-panel"
else
    SOURCE_DIR="$TEMP_DIR"
fi

echo -e "${GREEN}✓ 代码拉取完成${NC}"
echo ""

# 3. 同步代码
echo -e "${BLUE}[3/4]${NC} 同步代码..."

# 同步所有文件（排除 data 和 node_modules）
if command -v rsync &> /dev/null; then
    rsync -av --delete --exclude='data' --exclude='node_modules' --exclude='.git' "$SOURCE_DIR/" ./ 2>&1 | grep -v "^sending\|^sent\|^total"
    echo -e "  ${GREEN}✓${NC} 使用 rsync 同步"
else
    # 备份 data 和 node_modules
    [ -d "node_modules" ] && mv node_modules /tmp/nm-backup-$$ 2>/dev/null || true

    # 删除旧文件（保留 data）
    find . -mindepth 1 -maxdepth 1 ! -name 'data' ! -name '.git' -exec rm -rf {} \; 2>/dev/null

    # 复制新文件
    cp -r "$SOURCE_DIR/"* ./
    cp -r "$SOURCE_DIR/".* ./ 2>/dev/null || true

    # 恢复 node_modules
    [ -d "/tmp/nm-backup-$$" ] && mv /tmp/nm-backup-$$ node_modules 2>/dev/null || true

    echo -e "  ${GREEN}✓${NC} 使用 cp 同步"
fi

# 清理临时目录
rm -rf "$TEMP_DIR"

# 恢复数据目录
if [ -n "$BACKUP_DIR" ] && [ -d "$BACKUP_DIR" ]; then
    rm -rf data
    cp -r "$BACKUP_DIR" data
    echo -e "  ${GREEN}✓${NC} 数据已恢复"
fi

echo -e "${GREEN}✓ 代码同步完成${NC}"
echo ""

# 4. 安装依赖
echo -e "${BLUE}[4/4]${NC} 安装依赖..."
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}  检测到 node_modules 不存在，正在安装...${NC}"

    if npm install --ignore-scripts 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} 依赖安装完成"
    else
        echo -e "${YELLOW}  尝试使用国内镜像...${NC}"
        if npm install --registry=https://registry.npmmirror.com --ignore-scripts; then
            echo -e "  ${GREEN}✓${NC} 依赖安装完成（国内镜像）"
        else
            echo -e "${RED}✗ 依赖安装失败${NC}"
            echo -e "${YELLOW}请手动运行: npm install${NC}"
        fi
    fi
else
    echo -e "${YELLOW}  node_modules 已存在，跳过安装${NC}"
    echo -e "${YELLOW}  如需重新安装，请运行: rm -rf node_modules && npm install${NC}"
fi
echo ""

# 获取新版本号
NEW_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")

# 显示更新结果
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✓ 强制更新成功！${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}版本信息:${NC}"
echo -e "  当前版本: ${GREEN}v${NEW_VERSION}${NC}"
echo ""
if [ -n "$BACKUP_DIR" ]; then
    echo -e "${BLUE}备份位置:${NC}"
    echo -e "  ${BACKUP_DIR}"
    echo ""
fi
echo -e "${BLUE}下一步:${NC}"
echo -e "  1. 启动服务:"
if command -v pm2 &> /dev/null; then
    echo -e "     ${YELLOW}pm2 restart soga-panel${NC} 或 ${YELLOW}pm2 start server/app.js --name soga-panel${NC}"
else
    echo -e "     ${YELLOW}npm start${NC} 或 ${YELLOW}node server/app.js${NC}"
fi
echo ""
echo -e "  2. 访问地址: ${GREEN}http://localhost:3000${NC}"
echo ""
echo -e "  3. 默认账号:"
echo -e "     用户名: ${YELLOW}admin${NC}"
echo -e "     密码:   ${YELLOW}admin123${NC}"
echo ""
echo -e "${YELLOW}提示: 登录后请立即修改密码！${NC}"
echo ""
