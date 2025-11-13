#!/bin/bash

# GitHub 发布脚本

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================"
echo "Soga Panel GitHub 发布脚本"
echo "================================"
echo ""

# 检查是否在 git 仓库中
if [ ! -d ".git" ]; then
    echo -e "${RED}错误: 当前目录不是 Git 仓库${NC}"
    echo ""
    echo "请先初始化 Git 仓库："
    echo "  git init"
    echo "  git remote add origin https://github.com/YOUR_USERNAME/soga-panel.git"
    exit 1
fi

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}检测到未提交的更改${NC}"
    git status --short
    echo ""
    read -p "是否继续提交这些更改? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "已取消"
        exit 1
    fi
fi

# 获取当前版本号
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}当前版本: v${CURRENT_VERSION}${NC}"
echo ""

# 输入新版本号
echo "请输入新版本号 (当前: ${CURRENT_VERSION})"
echo "版本格式示例: 1.1.1"
read -p "新版本号: " NEW_VERSION

if [ -z "$NEW_VERSION" ]; then
    echo -e "${RED}版本号不能为空${NC}"
    exit 1
fi

# 验证版本号格式
if ! [[ $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}版本号格式错误，应为: x.y.z${NC}"
    exit 1
fi

echo ""
echo "================================"
echo "准备发布 v${NEW_VERSION}"
echo "================================"
echo ""

# 更新 package.json 中的版本号
echo "1. 更新版本号..."
sed -i.bak "s/\"version\": \".*\"/\"version\": \"${NEW_VERSION}\"/" package.json
rm -f package.json.bak
echo -e "${GREEN}✓ package.json 已更新${NC}"
echo ""

# 输入更新说明
echo "2. 输入本次更新说明 (多行输入，输入 EOF 结束):"
echo ""
CHANGELOG_CONTENT=""
while IFS= read -r line; do
    if [ "$line" = "EOF" ]; then
        break
    fi
    CHANGELOG_CONTENT="${CHANGELOG_CONTENT}${line}\n"
done

if [ -z "$CHANGELOG_CONTENT" ]; then
    CHANGELOG_CONTENT="- 版本更新至 v${NEW_VERSION}"
fi

# 更新 CHANGELOG.md
echo ""
echo "3. 更新 CHANGELOG.md..."
TEMP_FILE=$(mktemp)
cat > "$TEMP_FILE" << EOF
# 更新日志

## v${NEW_VERSION} ($(date +%Y-%m-%d))

${CHANGELOG_CONTENT}

---

EOF

# 追加旧的更新日志
if [ -f "CHANGELOG.md" ]; then
    tail -n +3 CHANGELOG.md >> "$TEMP_FILE"
fi

mv "$TEMP_FILE" CHANGELOG.md
echo -e "${GREEN}✓ CHANGELOG.md 已更新${NC}"
echo ""

# Git 提交
echo "4. 提交更改..."
git add .
git commit -m "release: v${NEW_VERSION}

${CHANGELOG_CONTENT}"
echo -e "${GREEN}✓ 已提交更改${NC}"
echo ""

# 创建标签
echo "5. 创建 Git 标签..."
git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}

${CHANGELOG_CONTENT}"
echo -e "${GREEN}✓ 已创建标签 v${NEW_VERSION}${NC}"
echo ""

# 推送到远程仓库
echo "6. 推送到 GitHub..."
read -p "是否推送到远程仓库? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push origin main
    git push origin "v${NEW_VERSION}"
    echo -e "${GREEN}✓ 已推送到 GitHub${NC}"
    echo ""
    
    # 获取仓库信息
    REPO_URL=$(git config --get remote.origin.url)
    REPO_PATH=$(echo "$REPO_URL" | sed 's/.*github.com[:/]\(.*\)\.git/\1/')
    
    echo "================================"
    echo -e "${GREEN}✓ 发布完成！${NC}"
    echo "================================"
    echo ""
    echo "版本: v${NEW_VERSION}"
    echo "仓库: https://github.com/${REPO_PATH}"
    echo "标签: https://github.com/${REPO_PATH}/releases/tag/v${NEW_VERSION}"
    echo ""
    echo "下一步："
    echo "1. 访问 GitHub Releases 页面"
    echo "2. 创建新的 Release"
    echo "3. 上传打包文件 soga-panel.tar.gz"
    echo ""
    echo "打包命令："
    echo "  tar -czf soga-panel-v${NEW_VERSION}.tar.gz \\"
    echo "    --exclude='node_modules' \\"
    echo "    --exclude='data/servers.json' \\"
    echo "    --exclude='data/auth.json' \\"
    echo "    --exclude='.git' \\"
    echo "    --exclude='*.log' \\"
    echo "    --exclude='backup_*' \\"
    echo "    ."
else
    echo ""
    echo "已取消推送，您可以稍后手动推送："
    echo "  git push origin main"
    echo "  git push origin v${NEW_VERSION}"
fi

echo ""
