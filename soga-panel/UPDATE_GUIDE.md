# Soga Panel 更新指南

本文档介绍如何在 VPS 上一键更新 Soga Panel 到最新版本。

## 🚀 一键更新命令

### 方式 1：自动更新（推荐）

如果你已经安装了 Soga Panel，直接运行：

```bash
cd soga-panel && bash <(curl -fsSL https://raw.githubusercontent.com/gkd-cloud/gkdcloud/main/soga-panel/auto-update.sh)
```

或者如果脚本已在本地：

```bash
cd soga-panel && chmod +x auto-update.sh && ./auto-update.sh
```

### 方式 2：从零安装/更新

如果是首次安装或需要全新部署：

```bash
# 克隆仓库
git clone https://github.com/gkd-cloud/gkdcloud.git
cd gkdcloud/soga-panel

# 运行部署脚本
chmod +x deploy.sh && ./deploy.sh
```

## 📋 更新步骤说明

`auto-update.sh` 脚本会自动执行以下步骤：

1. ✅ **备份当前版本**
   - 备份 `data` 目录（保留你的服务器和实例配置）
   - 备份 `package.json`
   - 备份到 `../soga-panel-backup-[时间戳]`

2. ✅ **检查更新**
   - 从 GitHub 检查是否有新版本
   - 如果已是最新版本，自动退出

3. ✅ **拉取最新代码**
   - 从 GitHub 拉取最新代码
   - 自动保留你的数据目录

4. ✅ **停止服务**
   - 如果使用 PM2，停止 PM2 服务
   - 如果使用 nohup，停止 Node 进程

5. ✅ **更新依赖**
   - 清理旧的 node_modules
   - 安装最新依赖
   - 自动尝试国内镜像（如果失败）

6. ✅ **测试启动**
   - 测试新版本能否正常启动
   - 如果失败，自动恢复备份

7. ✅ **重启服务**
   - 使用 PM2 或 nohup 重启服务
   - 显示更新结果和服务信息

## 🔧 环境变量配置

可以通过环境变量自定义更新行为：

```bash
# 指定 GitHub 仓库
GITHUB_REPO=your-username/your-repo ./auto-update.sh

# 指定分支
BRANCH=develop ./auto-update.sh

# 同时指定仓库和分支
GITHUB_REPO=your-username/your-repo BRANCH=develop ./auto-update.sh
```

## ⚙️ 更新后管理

### PM2 方式

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs soga-panel

# 重启服务
pm2 restart soga-panel

# 停止服务
pm2 stop soga-panel
```

### nohup 方式

```bash
# 查看日志
tail -f soga-panel/soga-panel.log

# 停止服务
pkill -f "node server/app.js"

# 重新启动
cd soga-panel && nohup npm start > soga-panel.log 2>&1 &
```

## 🔄 更新频率建议

- **稳定版本**: 每月检查一次更新
- **开发版本**: 根据需要随时更新
- **安全更新**: 立即更新

## 📦 手动更新（备用方案）

如果自动更新失败，可以手动更新：

```bash
# 1. 备份数据
cp -r soga-panel/data ~/soga-panel-data-backup

# 2. 停止服务
pm2 stop soga-panel
# 或
pkill -f "node server/app.js"

# 3. 拉取最新代码
cd soga-panel
git pull origin main

# 4. 恢复数据
cp -r ~/soga-panel-data-backup/* data/

# 5. 重新安装依赖
rm -rf node_modules package-lock.json
npm install --ignore-scripts

# 6. 重启服务
pm2 restart soga-panel
# 或
nohup npm start > soga-panel.log 2>&1 &
```

## 🛡️ 安全提醒

1. **定期备份**: 更新前会自动备份，但建议定期手动备份 `data` 目录
2. **测试环境**: 重要生产环境建议先在测试环境验证
3. **回滚方案**: 保留最近的备份，以便快速回滚

## 🆘 故障恢复

### 更新失败恢复

如果更新后服务无法启动：

```bash
# 1. 恢复数据（backup 目录名从更新时显示的信息中获取）
cp -r ../soga-panel-backup-[时间戳]/data ./

# 2. 查看错误日志
node server/app.js

# 3. 或回滚到上一个 git 版本
git log --oneline -5  # 查看最近的提交
git reset --hard [上一个提交的hash]
```

### 完全重置

如果遇到无法解决的问题，可以完全重置：

```bash
# 1. 备份数据
cp -r soga-panel/data ~/soga-panel-data-backup

# 2. 删除旧版本
rm -rf soga-panel

# 3. 重新克隆
git clone https://github.com/gkd-cloud/gkdcloud.git
cd gkdcloud/soga-panel

# 4. 恢复数据
mkdir -p data
cp -r ~/soga-panel-data-backup/* data/

# 5. 安装依赖
npm install --ignore-scripts

# 6. 启动服务
pm2 start server/app.js --name soga-panel
```

## 📞 获取帮助

- **文档**: 查看 [README.md](README.md) 了解完整功能
- **故障排查**: 查看 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **API 文档**: 查看 [API.md](API.md)
- **部署指南**: 查看 [DEPLOYMENT.md](DEPLOYMENT.md)

## 🎯 快速参考

| 命令 | 说明 |
|------|------|
| `./auto-update.sh` | 一键自动更新 |
| `./deploy.sh` | 完整部署脚本 |
| `./check.sh` | 检查文件完整性 |
| `npm start` | 启动服务 |
| `pm2 status` | 查看 PM2 状态 |
| `pm2 logs soga-panel` | 查看日志 |

## ✨ 更新日志

查看 [CHANGELOG.md](CHANGELOG.md) 了解每个版本的更新内容。

---

**提示**: 建议在更新前阅读最新的 [CHANGELOG.md](CHANGELOG.md)，了解新版本的变化和注意事项。
