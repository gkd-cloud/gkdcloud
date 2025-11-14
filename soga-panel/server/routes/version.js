const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);
const VERSION_FILE = path.join(__dirname, '../../version.json');

// 读取版本信息
const readVersion = async () => {
  try {
    const data = await fs.readFile(VERSION_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取版本信息失败:', error);
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      repository: 'gkd-cloud/gkdcloud',
      updateBranch: 'main'
    };
  }
};

// 写入版本信息
const writeVersion = async (versionData) => {
  await fs.writeFile(VERSION_FILE, JSON.stringify(versionData, null, 2));
};

// 从 GitHub 获取最新版本信息（支持 Release 和 Commit 两种模式）
const fetchGitHubLatestVersion = async (repo, branch = 'main') => {
  // 先尝试获取 Release
  try {
    const releaseInfo = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${repo}/releases/latest`,
        method: 'GET',
        headers: {
          'User-Agent': 'Soga-Panel'
        }
      };

      https.get(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const release = JSON.parse(data);
            if (release.tag_name) {
              resolve({
                version: release.tag_name.replace(/^v/, ''),
                publishedAt: release.published_at,
                description: release.body || '',
                htmlUrl: release.html_url,
                type: 'release'
              });
            } else {
              reject(new Error('No release found'));
            }
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
    return releaseInfo;
  } catch (releaseError) {
    // Release 不存在，尝试获取最新 commit
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${repo}/commits/${branch}`,
        method: 'GET',
        headers: {
          'User-Agent': 'Soga-Panel'
        }
      };

      https.get(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const commit = JSON.parse(data);
            if (commit.sha) {
              // 使用 commit 日期作为版本号
              const commitDate = new Date(commit.commit.author.date);
              const version = `1.0.${commitDate.getFullYear()}${String(commitDate.getMonth() + 1).padStart(2, '0')}${String(commitDate.getDate()).padStart(2, '0')}`;

              resolve({
                version: version,
                commit: commit.sha.substring(0, 7),
                publishedAt: commit.commit.author.date,
                description: `最新提交: ${commit.commit.message}\n\nCommit: ${commit.sha.substring(0, 7)}\n作者: ${commit.commit.author.name}`,
                htmlUrl: commit.html_url,
                type: 'commit'
              });
            } else {
              reject(new Error('未找到最新提交'));
            }
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }
};

// 比较版本号
const compareVersions = (v1, v2) => {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
};

// 递增版本号
const incrementVersion = (version) => {
  const parts = version.split('.');
  const patch = parseInt(parts[2] || 0);
  return `${parts[0]}.${parts[1]}.${patch + 1}`;
};

// 获取当前版本
router.get('/current', async (req, res) => {
  try {
    const versionInfo = await readVersion();
    res.json({ success: true, version: versionInfo });
  } catch (error) {
    console.error('获取版本信息失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 检查更新
router.get('/check-update', async (req, res) => {
  try {
    const currentVersion = await readVersion();

    try {
      const latestVersion = await fetchGitHubLatestVersion(
        currentVersion.repository,
        currentVersion.updateBranch || 'main'
      );

      const hasUpdate = compareVersions(latestVersion.version, currentVersion.version) > 0;

      res.json({
        success: true,
        current: currentVersion.version,
        latest: latestVersion.version,
        hasUpdate,
        updateInfo: hasUpdate ? latestVersion : null,
        updateType: latestVersion.type // 'release' 或 'commit'
      });
    } catch (error) {
      console.error('检查 GitHub 更新失败:', error);
      // 如果无法连接 GitHub，返回当前版本信息
      res.json({
        success: true,
        current: currentVersion.version,
        latest: currentVersion.version,
        hasUpdate: false,
        error: '无法连接到 GitHub，请检查网络连接'
      });
    }
  } catch (error) {
    console.error('检查更新失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 执行更新
router.post('/update', async (req, res) => {
  try {
    const currentVersion = await readVersion();
    const panelRoot = path.join(__dirname, '../..');

    console.log('开始更新面板...');
    console.log('面板目录:', panelRoot);

    // 创建更新脚本
    const updateScript = `
#!/bin/bash
set -e

echo "========================================="
echo "Soga Panel 更新脚本"
echo "========================================="

cd "${panelRoot}"

echo "1. 备份当前版本..."
BACKUP_DIR="./backup/\$(date +%Y%m%d_%H%M%S)"
mkdir -p "\$BACKUP_DIR"
cp -r ./server "\$BACKUP_DIR/" || true
cp -r ./public "\$BACKUP_DIR/" || true
cp version.json "\$BACKUP_DIR/" || true
echo "✓ 备份完成: \$BACKUP_DIR"

echo "2. 拉取最新代码..."
git fetch origin ${currentVersion.updateBranch}
git pull origin ${currentVersion.updateBranch}
echo "✓ 代码更新完成"

echo "3. 安装依赖..."
cd server
npm install --production
echo "✓ 依赖安装完成"

echo "4. 重启服务..."
pm2 restart soga-panel || npm start &
echo "✓ 服务重启完成"

echo "========================================="
echo "更新完成！"
echo "========================================="
    `.trim();

    // 将脚本写入临时文件
    const scriptPath = path.join(panelRoot, 'update-temp.sh');
    await fs.writeFile(scriptPath, updateScript);
    await fs.chmod(scriptPath, '755');

    // 后台执行更新脚本
    exec(`nohup ${scriptPath} > ${panelRoot}/update.log 2>&1 &`, (error) => {
      if (error) {
        console.error('启动更新脚本失败:', error);
      }
    });

    // 更新版本信息
    const newVersion = incrementVersion(currentVersion.version);
    const newVersionData = {
      ...currentVersion,
      version: newVersion,
      lastUpdated: new Date().toISOString()
    };
    await writeVersion(newVersionData);

    res.json({
      success: true,
      message: '更新已开始，请等待约 30 秒后刷新页面',
      newVersion,
      logFile: path.join(panelRoot, 'update.log')
    });
  } catch (error) {
    console.error('执行更新失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取更新日志
router.get('/update-log', async (req, res) => {
  try {
    const panelRoot = path.join(__dirname, '../..');
    const logPath = path.join(panelRoot, 'update.log');

    try {
      const log = await fs.readFile(logPath, 'utf8');
      res.json({ success: true, log });
    } catch (error) {
      res.json({ success: true, log: '暂无更新日志' });
    }
  } catch (error) {
    console.error('获取更新日志失败:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
