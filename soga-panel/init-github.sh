#!/bin/bash

# GitHub 仓库初始化脚本

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "================================"
echo "Soga Panel GitHub 仓库初始化"
echo "================================"
echo ""

# 检查 git 是否安装
if ! command -v git &> /dev/null; then
    echo -e "${RED}错误: 未安装 Git${NC}"
    echo ""
    echo "安装 Git:"
    echo "  Ubuntu/Debian: sudo apt-get install git"
    echo "  CentOS: sudo yum install git"
    exit 1
fi

# 检查是否已经是 git 仓库
if [ -d ".git" ]; then
    echo -e "${YELLOW}当前目录已经是 Git 仓库${NC}"
    echo ""
    read -p "是否重新初始化? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "已取消"
        exit 0
    fi
    rm -rf .git
fi

# 输入 GitHub 仓库信息
echo "请输入 GitHub 仓库信息"
echo ""
read -p "GitHub 用户名: " GITHUB_USERNAME
read -p "仓库名称 (例如: soga-panel): " REPO_NAME

if [ -z "$GITHUB_USERNAME" ] || [ -z "$REPO_NAME" ]; then
    echo -e "${RED}用户名和仓库名不能为空${NC}"
    exit 1
fi

REPO_URL="https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"

echo ""
echo "================================"
echo "仓库信息"
echo "================================"
echo "用户名: ${GITHUB_USERNAME}"
echo "仓库名: ${REPO_NAME}"
echo "仓库地址: ${REPO_URL}"
echo ""

read -p "确认以上信息正确? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 0
fi

echo ""
echo "================================"
echo "初始化 Git 仓库"
echo "================================"
echo ""

# 初始化 git 仓库
echo "1. 初始化 Git..."
git init
git branch -M main
echo -e "${GREEN}✓ Git 仓库已初始化${NC}"
echo ""

# 配置 git
echo "2. 配置 Git..."
read -p "输入您的 Git 用户名: " GIT_USER
read -p "输入您的 Git 邮箱: " GIT_EMAIL

git config user.name "$GIT_USER"
git config user.email "$GIT_EMAIL"
echo -e "${GREEN}✓ Git 配置完成${NC}"
echo ""

# 添加远程仓库
echo "3. 添加远程仓库..."
git remote add origin "$REPO_URL"
echo -e "${GREEN}✓ 远程仓库已添加${NC}"
echo ""

# 创建初始提交
echo "4. 创建初始提交..."
git add .
git commit -m "feat: initial commit - Soga Panel v1.1.0

功能特性:
- ✅ 用户认证系统
- ✅ 离线授权支持
- ✅ 在线授权支持
- ✅ 一键更新脚本
- ✅ Soga 版本管理
- ✅ 服务器管理
- ✅ 实例管理
- ✅ 日志查看
"
echo -e "${GREEN}✓ 初始提交已创建${NC}"
echo ""

# 创建标签
echo "5. 创建版本标签..."
git tag -a "v1.1.0" -m "Release v1.1.0

初始版本发布"
echo -e "${GREEN}✓ 标签 v1.1.0 已创建${NC}"
echo ""

echo "================================"
echo -e "${GREEN}✓ 初始化完成！${NC}"
echo "================================"
echo ""
echo -e "${YELLOW}下一步操作:${NC}"
echo ""
echo "1. 在 GitHub 上创建仓库:"
echo "   访问: https://github.com/new"
echo "   仓库名: ${REPO_NAME}"
echo "   可见性: Public 或 Private"
echo "   ${RED}不要${NC} 初始化 README、.gitignore 或 license"
echo ""
echo "2. 推送代码到 GitHub:"
echo "   git push -u origin main"
echo "   git push origin v1.1.0"
echo ""
echo "3. 创建第一个 Release:"
echo "   访问: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}/releases/new"
echo "   选择标签: v1.1.0"
echo "   发布标题: Release v1.1.0"
echo ""
echo "4. 上传打包文件:"
echo "   运行打包命令:"
echo "   tar -czf soga-panel-v1.1.0.tar.gz \\"
echo "     --exclude='node_modules' \\"
echo "     --exclude='data/servers.json' \\"
echo "     --exclude='data/auth.json' \\"
echo "     --exclude='.git' \\"
echo "     --exclude='*.log' \\"
echo "     ."
echo ""
echo "   然后将 soga-panel-v1.1.0.tar.gz 上传到 Release"
echo ""
echo -e "${BLUE}提示: 后续版本更新使用 ./release.sh 脚本${NC}"
echo ""
