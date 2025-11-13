# GitHub 仓库管理指南

## 📚 目录

1. [初始化 GitHub 仓库](#初始化-github-仓库)
2. [发布新版本](#发布新版本)
3. [用户更新方法](#用户更新方法)
4. [自动化发布](#自动化发布)
5. [常见问题](#常见问题)

---

## 初始化 GitHub 仓库

### 方式一：使用自动化脚本（推荐）

```bash
cd soga-panel
chmod +x init-github.sh
./init-github.sh
```

脚本会引导你完成：
1. 初始化 Git 仓库
2. 配置 Git 用户信息
3. 添加远程仓库
4. 创建初始提交
5. 创建版本标签

### 方式二：手动初始化

```bash
# 1. 初始化 Git 仓库
git init
git branch -M main

# 2. 配置 Git
git config user.name "Your Name"
git config user.email "your.email@example.com"

# 3. 添加远程仓库
git remote add origin https://github.com/YOUR_USERNAME/soga-panel.git

# 4. 创建初始提交
git add .
git commit -m "feat: initial commit - Soga Panel v1.1.0"

# 5. 创建标签
git tag -a v1.1.0 -m "Release v1.1.0"

# 6. 推送到 GitHub
git push -u origin main
git push origin v1.1.0
```

### 在 GitHub 上创建仓库

1. 访问 https://github.com/new
2. 仓库名称：`soga-panel`
3. 描述：`Soga SSR Panel - 一键部署和管理 Soga 实例的 Web 面板`
4. 可见性：Public 或 Private
5. **不要**勾选 "Initialize this repository with:"
6. 点击 "Create repository"

---

## 发布新版本

### 使用发布脚本（推荐）

```bash
chmod +x release.sh
./release.sh
```

脚本会自动：
1. 更新 package.json 版本号
2. 提示输入更新说明
3. 更新 CHANGELOG.md
4. 创建 Git 提交和标签
5. 推送到 GitHub

### 手动发布流程

#### 1. 更新版本号

编辑 `package.json`：
```json
{
  "version": "1.2.0"
}
```

#### 2. 更新 CHANGELOG.md

在文件开头添加：
```markdown
## v1.2.0 (2024-11-13)

### 新功能
- ✅ 添加批量操作功能
- ✅ 优化界面样式

### Bug 修复
- 🐛 修复下载错误
```

#### 3. 提交更改

```bash
git add .
git commit -m "release: v1.2.0

新功能:
- 添加批量操作功能
- 优化界面样式

Bug 修复:
- 修复下载错误"
```

#### 4. 创建标签

```bash
git tag -a v1.2.0 -m "Release v1.2.0"
```

#### 5. 推送到 GitHub

```bash
git push origin main
git push origin v1.2.0
```

#### 6. 打包发布文件

```bash
tar -czf soga-panel-v1.2.0.tar.gz \
  --exclude='node_modules' \
  --exclude='data/servers.json' \
  --exclude='data/auth.json' \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='*.log' \
  --exclude='backup_*' \
  .
```

#### 7. 在 GitHub 上创建 Release

1. 访问 `https://github.com/YOUR_USERNAME/soga-panel/releases/new`
2. 选择标签：`v1.2.0`
3. Release 标题：`Release v1.2.0`
4. 描述：复制 CHANGELOG.md 中的更新内容
5. 上传 `soga-panel-v1.2.0.tar.gz`
6. 点击 "Publish release"

---

## 用户更新方法

### 方法一：从 GitHub 自动更新（推荐）

```bash
cd soga-panel
./update.sh

# 选择选项 1：从 GitHub 自动下载
# 输入仓库地址：username/soga-panel
```

脚本会自动：
1. 获取最新版本号
2. 下载最新版本
3. 备份当前数据
4. 更新文件
5. 重启服务

### 方法二：手动下载更新

```bash
# 1. 下载最新版本
wget https://github.com/YOUR_USERNAME/soga-panel/releases/latest/download/soga-panel-vX.X.X.tar.gz

# 2. 运行更新脚本
cd soga-panel
mv ~/soga-panel-vX.X.X.tar.gz ./soga-panel.tar.gz
./update.sh

# 选择选项 2：使用本地文件
```

### 用户配置文件

在用户的 soga-panel 目录下创建 `.update-config`：
```bash
# GitHub 仓库配置
GITHUB_REPO="YOUR_USERNAME/soga-panel"

# 自动更新检查（可选）
AUTO_CHECK_UPDATE=true
```

---

## 自动化发布

### GitHub Actions 工作流

项目已包含 `.github/workflows/release.yml`，功能：
1. 监听 tag 推送（格式：`v*`）
2. 自动打包项目
3. 创建 GitHub Release
4. 上传发布文件

### 使用方法

只需推送标签即可触发自动发布：
```bash
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0
```

GitHub Actions 会自动：
- 创建 Release
- 上传 `soga-panel-v1.2.0.tar.gz`
- 从 CHANGELOG.md 提取更新说明

### 查看工作流状态

访问：`https://github.com/YOUR_USERNAME/soga-panel/actions`

---

## 版本管理最佳实践

### 语义化版本

遵循 [Semantic Versioning](https://semver.org/)：

- **主版本号 (Major)**：不兼容的 API 修改
  - `1.0.0` → `2.0.0`
  - 示例：重写认证系统、数据库结构变更

- **次版本号 (Minor)**：向下兼容的功能新增
  - `1.1.0` → `1.2.0`
  - 示例：新增批量操作、添加新的 API

- **修订号 (Patch)**：向下兼容的问题修正
  - `1.1.0` → `1.1.1`
  - 示例：Bug 修复、性能优化

### 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```bash
# 新功能
git commit -m "feat: 添加批量删除功能"

# Bug 修复
git commit -m "fix: 修复下载超时问题"

# 文档更新
git commit -m "docs: 更新 API 文档"

# 性能优化
git commit -m "perf: 优化 SSH 连接池"

# 重构代码
git commit -m "refactor: 重构认证模块"

# 测试相关
git commit -m "test: 添加单元测试"

# 构建相关
git commit -m "build: 更新依赖版本"

# 发布版本
git commit -m "release: v1.2.0"
```

### 分支管理

```
main          # 主分支，稳定版本
├── develop   # 开发分支
├── feature/* # 功能分支
└── hotfix/*  # 热修复分支
```

**工作流程：**
1. 从 `develop` 创建 `feature/xxx` 分支
2. 开发完成后合并回 `develop`
3. 测试通过后合并到 `main`
4. 在 `main` 上打标签发布

---

## 常见问题

### Q1: 如何回滚版本？

```bash
# 查看所有标签
git tag

# 检出指定版本
git checkout v1.1.0

# 打包旧版本
tar -czf soga-panel-v1.1.0.tar.gz \
  --exclude='node_modules' \
  --exclude='data' \
  --exclude='.git' \
  .
```

### Q2: 如何删除错误的标签？

```bash
# 删除本地标签
git tag -d v1.2.0

# 删除远程标签
git push origin :refs/tags/v1.2.0
```

### Q3: 如何修改已发布的 Release？

1. 访问 Release 页面
2. 点击 "Edit release"
3. 修改内容
4. 点击 "Update release"

### Q4: GitHub Actions 失败怎么办？

1. 访问 Actions 页面查看错误日志
2. 常见问题：
   - CHANGELOG.md 格式错误
   - 权限不足（需要配置 GITHUB_TOKEN）
   - 打包路径错误

### Q5: 如何设置自动更新检查？

在用户端添加定时任务：
```bash
crontab -e

# 每天凌晨 2 点检查更新
0 2 * * * cd /path/to/soga-panel && ./update.sh auto
```

### Q6: 如何迁移到新的 GitHub 账号？

```bash
# 更改远程仓库地址
git remote set-url origin https://github.com/NEW_USERNAME/soga-panel.git

# 推送所有内容
git push -u origin main --tags
```

---

## 发布检查清单

发布新版本前，确保完成：

- [ ] 更新 package.json 版本号
- [ ] 更新 CHANGELOG.md
- [ ] 所有测试通过
- [ ] 文档已更新
- [ ] 提交所有更改
- [ ] 创建版本标签
- [ ] 推送到 GitHub
- [ ] 打包发布文件
- [ ] 创建 GitHub Release
- [ ] 测试更新流程
- [ ] 通知用户更新

---

## 相关链接

- GitHub 文档：https://docs.github.com/
- Semantic Versioning：https://semver.org/
- Conventional Commits：https://www.conventionalcommits.org/
- GitHub Actions：https://docs.github.com/en/actions

---

## 联系方式

如有问题，请：
1. 提交 Issue：`https://github.com/YOUR_USERNAME/soga-panel/issues`
2. 发起讨论：`https://github.com/YOUR_USERNAME/soga-panel/discussions`
