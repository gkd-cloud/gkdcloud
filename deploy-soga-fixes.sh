#!/bin/bash

# Soga Panel 修复部署脚本
# 用于快速部署所有修复到现有的 soga-panel 安装

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Soga Panel 修复部署${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# 检查是否在 soga-panel 目录
if [ ! -f "package.json" ] || ! grep -q "soga-panel" package.json 2>/dev/null; then
    echo -e "${RED}错误: 请在 soga-panel 目录下运行此脚本${NC}"
    echo -e "${YELLOW}用法: cd /path/to/soga-panel && bash deploy-soga-fixes.sh${NC}"
    exit 1
fi

echo -e "${YELLOW}当前目录: $(pwd)${NC}"
echo -e "${YELLOW}准备部署修复...${NC}"
echo ""

# GitHub 分支
BRANCH="claude/soga-panel-integration-011CV69zjExXtBjyLhCT2C1i"
BASE_URL="https://raw.githubusercontent.com/gkd-cloud/gkdcloud/${BRANCH}/soga-panel"

# 备份现有文件
echo -e "${BLUE}[1/3]${NC} 备份现有文件..."
BACKUP_DIR="/tmp/soga-panel-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

[ -f "force-update.sh" ] && cp force-update.sh "$BACKUP_DIR/"
[ -f "auto-update.sh" ] && cp auto-update.sh "$BACKUP_DIR/"
[ -f "install-update-script.sh" ] && cp install-update-script.sh "$BACKUP_DIR/"
[ -f "public/index.html" ] && cp public/index.html "$BACKUP_DIR/"

echo -e "  ${GREEN}✓${NC} 备份完成: $BACKUP_DIR"
echo ""

# 下载修复后的文件
echo -e "${BLUE}[2/3]${NC} 下载修复文件..."

download_file() {
    local file=$1
    local url="${BASE_URL}/${file}"

    echo -e "  下载: ${file}..."
    if curl -f -s -o "${file}" "${url}"; then
        echo -e "  ${GREEN}✓${NC} ${file}"
        return 0
    else
        echo -e "  ${RED}✗${NC} ${file} 下载失败"
        return 1
    fi
}

# 下载所有文件
download_file "force-update.sh" || exit 1
download_file "auto-update.sh" || exit 1
download_file "install-update-script.sh" || exit 1
download_file "public/index.html" || exit 1
download_file "public/js/main.js" || exit 1

echo ""

# 设置权限
echo -e "${BLUE}[3/3]${NC} 设置权限..."
chmod +x force-update.sh auto-update.sh install-update-script.sh
echo -e "  ${GREEN}✓${NC} 权限设置完成"
echo ""

# 显示修复列表
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✓ 部署成功！${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}已修复的问题:${NC}"
echo -e "  1. Git 所有权检查错误"
echo -e "  2. Git Remote 配置问题"
echo -e "  3. 子目录部署问题"
echo -e "  4. 登录页面跳转问题"
echo -e "  5. API 认证 token 未附加问题"
echo -e "  6. 新增强制更新脚本"
echo ""
echo -e "${BLUE}备份位置:${NC}"
echo -e "  ${BACKUP_DIR}"
echo ""
echo -e "${BLUE}下一步:${NC}"
echo -e "  ${YELLOW}bash force-update.sh${NC}  - 强制同步最新代码"
echo -e "  ${YELLOW}bash auto-update.sh${NC}   - 常规更新（检查版本）"
echo ""
echo -e "${BLUE}或直接启动服务:${NC}"
echo -e "  ${YELLOW}npm start${NC} 或 ${YELLOW}pm2 restart soga-panel${NC}"
echo ""
