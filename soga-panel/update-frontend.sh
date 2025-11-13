#!/bin/bash

# 前端更新脚本 - 添加认证和离线模式支持

cat > public/js/auth.js << 'EOF'
// 认证管理
const AuthManager = {
    // 获取 token
    getToken() {
        return localStorage.getItem('token');
    },

    // 检查是否已登录
    isAuthenticated() {
        const token = this.getToken();
        const expiresAt = localStorage.getItem('tokenExpiresAt');
        
        if (!token || !expiresAt) {
            return false;
        }
        
        // 检查是否过期
        if (new Date(expiresAt) < new Date()) {
            this.logout();
            return false;
        }
        
        return true;
    },

    // 登出
    logout() {
        const token = this.getToken();
        
        if (token) {
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        }
        
        localStorage.removeItem('token');
        localStorage.removeItem('tokenExpiresAt');
        window.location.href = '/login.html';
    },

    // 添加认证头
    getAuthHeaders() {
        const token = this.getToken();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }
};

// 页面加载时检查认证
document.addEventListener('DOMContentLoaded', () => {
    // 如果不是登录页面，检查认证状态
    if (!window.location.pathname.includes('login.html')) {
        if (!AuthManager.isAuthenticated()) {
            window.location.href = '/login.html';
        }
    }
});
EOF

cat > public/js/offline-mode.js << 'EOF'
// 离线模式管理
const OfflineMode = {
    // 读取文件为 Base64
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    // 添加文件上传控件到表单
    addToForm(formElement) {
        const offlineSection = document.createElement('div');
        offlineSection.className = 'form-section';
        offlineSection.innerHTML = `
            <h4>Soga 版本配置</h4>
            <div class="form-group">
                <label>
                    <input type="checkbox" name="offlineMode" id="offline-mode-checkbox">
                    使用离线授权模式
                </label>
                <small>勾选后需要上传离线授权的 tar.gz 包</small>
            </div>
            <div class="form-group" id="online-version-group">
                <label>Soga 版本（在线模式）</label>
                <select name="sogaVersion">
                    <option value="latest">最新版本（推荐）</option>
                    <option value="v0.10.5">v0.10.5</option>
                    <option value="v0.10.4">v0.10.4</option>
                    <option value="v0.10.3">v0.10.3</option>
                </select>
                <small>从 GitHub 自动下载指定版本</small>
            </div>
            <div class="form-group" id="offline-package-group" style="display: none;">
                <label>上传离线授权包 *</label>
                <input type="file" id="offline-package" accept=".tar.gz,.tgz">
                <small>上传离线授权的 soga.tar.gz 文件</small>
            </div>
        `;

        // 插入到实例名称后面
        const instanceNameGroup = formElement.querySelector('input[name="instanceName"]').closest('.form-group');
        instanceNameGroup.parentNode.insertBefore(offlineSection, instanceNameGroup.nextSibling);

        // 绑定切换事件
        const checkbox = document.getElementById('offline-mode-checkbox');
        const onlineGroup = document.getElementById('online-version-group');
        const offlineGroup = document.getElementById('offline-package-group');

        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                onlineGroup.style.display = 'none';
                offlineGroup.style.display = 'block';
            } else {
                onlineGroup.style.display = 'block';
                offlineGroup.style.display = 'none';
            }
        });
    },

    // 从表单获取配置
    async getConfig(formElement) {
        const offlineMode = formElement.querySelector('#offline-mode-checkbox').checked;
        const config = { offlineMode };

        if (offlineMode) {
            const fileInput = document.getElementById('offline-package');
            if (fileInput.files.length === 0) {
                throw new Error('请上传离线授权包');
            }

            const file = fileInput.files[0];
            if (!file.name.endsWith('.tar.gz') && !file.name.endsWith('.tgz')) {
                throw new Error('请上传 .tar.gz 格式的文件');
            }

            config.sogaPackage = await this.fileToBase64(file);
        } else {
            const versionSelect = formElement.querySelector('select[name="sogaVersion"]');
            config.sogaVersion = versionSelect.value;
        }

        return config;
    }
};
EOF

echo "前端更新脚本已生成"
echo "文件位置："
echo "  - public/js/auth.js (认证管理)"
echo "  - public/js/offline-mode.js (离线模式)"
echo ""
echo "需要在 public/index.html 中引入这些文件："
echo '<script src="js/auth.js"></script>'
echo '<script src="js/offline-mode.js"></script>'
