#!/bin/bash

# Soga Panel 本地部署脚本
# 从本地代码仓库复制修复文件到部署目录

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Soga Panel 本地部署${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# 源代码目录
SOURCE_DIR="/home/user/gkdcloud/soga-panel"

# 检查源代码目录
if [ ! -d "$SOURCE_DIR" ]; then
    echo -e "${RED}错误: 源代码目录不存在: $SOURCE_DIR${NC}"
    exit 1
fi

# 获取目标目录（当前目录或命令行参数）
TARGET_DIR="${1:-.}"

if [ "$TARGET_DIR" = "." ]; then
    TARGET_DIR=$(pwd)
fi

# 检查目标目录
if [ ! -f "$TARGET_DIR/package.json" ] || ! grep -q "soga-panel" "$TARGET_DIR/package.json" 2>/dev/null; then
    echo -e "${RED}错误: 目标目录不是 soga-panel 项目${NC}"
    echo -e "${YELLOW}当前目录: $TARGET_DIR${NC}"
    echo -e "${YELLOW}用法: bash deploy-local.sh [目标目录]${NC}"
    echo -e "${YELLOW}示例: bash deploy-local.sh /root/soga-panel${NC}"
    exit 1
fi

echo -e "${YELLOW}源目录: $SOURCE_DIR${NC}"
echo -e "${YELLOW}目标目录: $TARGET_DIR${NC}"
echo ""

# 备份现有文件
echo -e "${BLUE}[1/3]${NC} 备份现有文件..."
BACKUP_DIR="/tmp/soga-panel-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

[ -f "$TARGET_DIR/force-update.sh" ] && cp "$TARGET_DIR/force-update.sh" "$BACKUP_DIR/"
[ -f "$TARGET_DIR/auto-update.sh" ] && cp "$TARGET_DIR/auto-update.sh" "$BACKUP_DIR/"
[ -f "$TARGET_DIR/install-update-script.sh" ] && cp "$TARGET_DIR/install-update-script.sh" "$BACKUP_DIR/"
[ -f "$TARGET_DIR/public/index.html" ] && cp "$TARGET_DIR/public/index.html" "$BACKUP_DIR/"
[ -f "$TARGET_DIR/public/js/main.js" ] && cp "$TARGET_DIR/public/js/main.js" "$BACKUP_DIR/"

echo -e "  ${GREEN}✓${NC} 备份完成: $BACKUP_DIR"
echo ""

# 复制修复文件
echo -e "${BLUE}[2/3]${NC} 复制修复文件..."

copy_file() {
    local file=$1
    local source="$SOURCE_DIR/$file"
    local target="$TARGET_DIR/$file"

    if [ -f "$source" ]; then
        cp "$source" "$target"
        echo -e "  ${GREEN}✓${NC} ${file}"
        return 0
    else
        echo -e "  ${RED}✗${NC} ${file} 源文件不存在"
        return 1
    fi
}

# 创建目录（如果需要）
mkdir -p "$TARGET_DIR/public/js"

# 复制所有文件
copy_file "force-update.sh" || exit 1
copy_file "auto-update.sh" || exit 1
copy_file "install-update-script.sh" || exit 1
copy_file "public/index.html" || exit 1
copy_file "public/js/main.js" || exit 1

echo ""

# 设置权限
echo -e "${BLUE}[3/3]${NC} 设置权限..."
chmod +x "$TARGET_DIR/force-update.sh" "$TARGET_DIR/auto-update.sh" "$TARGET_DIR/install-update-script.sh"
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
echo -e "  ${YELLOW}cd $TARGET_DIR${NC}"
echo -e "  ${YELLOW}bash force-update.sh${NC}  - 强制同步最新代码（需要网络）"
echo ""
echo -e "${BLUE}或直接重启服务:${NC}"
echo -e "  ${YELLOW}npm start${NC} 或 ${YELLOW}pm2 restart soga-panel${NC}"
echo ""
echo -e "${BLUE}访问地址:${NC}"
echo -e "  ${GREEN}http://localhost:3000${NC}"
echo ""
echo -e "${BLUE}默认账号:${NC}"
echo -e "  用户名: ${YELLOW}admin${NC}"
echo -e "  密码:   ${YELLOW}admin123${NC}"
echo ""
