const API_BASE = '/api';

// 状态管理
const state = {
    servers: [],
    instances: [],
    packages: [],
    currentTab: 'servers',
    currentServer: null,
    currentInstance: null
};

// DOM 元素
const elements = {
    tabBtns: document.querySelectorAll('.tab-btn'),
    serversList: document.getElementById('servers-list'),
    instancesList: document.getElementById('instances-list'),
    packagesList: document.getElementById('packages-list'),
    addServerBtn: document.getElementById('add-server-btn'),
    addServerModal: document.getElementById('add-server-modal'),
    addServerForm: document.getElementById('add-server-form'),
    createInstanceBtn: document.getElementById('create-instance-btn'),
    createInstanceModal: document.getElementById('create-instance-modal'),
    createInstanceForm: document.getElementById('create-instance-form'),
    uploadPackageBtn: document.getElementById('upload-package-btn'),
    uploadPackageModal: document.getElementById('upload-package-modal'),
    uploadPackageForm: document.getElementById('upload-package-form'),
    logsModal: document.getElementById('logs-modal'),
    authTypeSelect: document.getElementById('auth-type'),
    passwordGroup: document.getElementById('password-group'),
    keyGroup: document.getElementById('key-group')
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initModals();
    initAuthTypeSwitch();
    initInstallModeSwitch();
    loadServers();
    loadInstances();
    loadPackages();
});

// 标签页切换
function initTabs() {
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });
}

function switchTab(tab) {
    state.currentTab = tab;
    
    elements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tab}-tab`);
    });
}

// 模态框管理
function initModals() {
    // 关闭按钮
    document.querySelectorAll('.modal .close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').style.display = 'none';
        });
    });

    // 点击外部关闭
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    // 添加服务器
    elements.addServerBtn.addEventListener('click', () => {
        elements.addServerModal.style.display = 'block';
        elements.addServerForm.reset();
    });

    document.getElementById('cancel-server-btn').addEventListener('click', () => {
        elements.addServerModal.style.display = 'none';
    });

    elements.addServerForm.addEventListener('submit', handleAddServer);

    // 创建实例
    elements.createInstanceBtn.addEventListener('click', () => {
        if (state.servers.length === 0) {
            alert('请先添加服务器');
            return;
        }
        loadServerSelect();
        elements.createInstanceModal.style.display = 'block';
        elements.createInstanceForm.reset();
    });

    document.getElementById('cancel-instance-btn').addEventListener('click', () => {
        elements.createInstanceModal.style.display = 'none';
    });

    elements.createInstanceForm.addEventListener('submit', handleCreateInstance);

    // 日志模态框
    document.getElementById('close-logs-btn').addEventListener('click', () => {
        elements.logsModal.style.display = 'none';
    });

    document.getElementById('refresh-logs-btn').addEventListener('click', () => {
        if (state.currentServer && state.currentInstance) {
            loadLogs(state.currentServer, state.currentInstance);
        }
    });
}

// 认证方式切换
function initAuthTypeSwitch() {
    elements.authTypeSelect.addEventListener('change', (e) => {
        const authType = e.target.value;
        if (authType === 'password') {
            elements.passwordGroup.style.display = 'block';
            elements.keyGroup.style.display = 'none';
            elements.passwordGroup.querySelector('input').required = true;
            elements.keyGroup.querySelector('textarea').required = false;
        } else {
            elements.passwordGroup.style.display = 'none';
            elements.keyGroup.style.display = 'block';
            elements.passwordGroup.querySelector('input').required = false;
            elements.keyGroup.querySelector('textarea').required = true;
        }
    });
}

// 安装模式切换
function initInstallModeSwitch() {
    const installModeSelect = document.getElementById('install-mode-select');
    const versionGroup = document.getElementById('soga-version-group');
    const savedPackageGroup = document.getElementById('saved-package-group');
    const packageGroup = document.getElementById('soga-package-group');
    const fileInput = document.getElementById('soga-file-input');
    const savedPackageSelect = document.getElementById('saved-package-select');

    if (!installModeSelect) return;

    installModeSelect.addEventListener('change', async (e) => {
        const mode = e.target.value;

        if (mode === 'online') {
            versionGroup.style.display = 'block';
            savedPackageGroup.style.display = 'none';
            packageGroup.style.display = 'none';
            if (fileInput) fileInput.required = false;
            if (savedPackageSelect) savedPackageSelect.required = false;
        } else if (mode === 'offline-saved') {
            versionGroup.style.display = 'none';
            savedPackageGroup.style.display = 'block';
            packageGroup.style.display = 'none';
            if (fileInput) fileInput.required = false;
            if (savedPackageSelect) savedPackageSelect.required = true;

            // 加载已保存的离线包到下拉列表
            await loadSavedPackagesDropdown();
        } else if (mode === 'offline-upload') {
            versionGroup.style.display = 'none';
            savedPackageGroup.style.display = 'none';
            packageGroup.style.display = 'block';
            if (fileInput) fileInput.required = true;
            if (savedPackageSelect) savedPackageSelect.required = false;
        }
    });

    // 管理离线包链接
    document.getElementById('goto-packages-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        elements.createInstanceModal.style.display = 'none';
        switchTab('packages');
    });
}

// 加载已保存的离线包到下拉列表
async function loadSavedPackagesDropdown() {
    try {
        const data = await apiCall('/soga/packages');
        const select = document.getElementById('saved-package-select');

        if (!select) return;

        select.innerHTML = '<option value="">请选择已保存的离线包</option>';

        (data.packages || []).forEach(pkg => {
            const option = document.createElement('option');
            option.value = pkg.id;
            option.textContent = `${pkg.name} (${pkg.arch}) - ${formatSize(pkg.size)}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('加载离线包列表失败:', error);
    }
}

// API 调用
async function apiCall(endpoint, options = {}) {
    try {
        // 使用 AuthManager 获取认证头
        const authHeaders = AuthManager.getAuthHeaders();

        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                ...authHeaders,
                ...options.headers
            },
            ...options
        });

        const data = await response.json();

        if (!response.ok) {
            // 如果是401未授权，跳转到登录页
            if (response.status === 401) {
                AuthManager.logout();
                return;
            }
            throw new Error(data.error || '请求失败');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        alert(`错误: ${error.message}`);
        throw error;
    }
}

// 加载服务器列表
async function loadServers() {
    try {
        elements.serversList.innerHTML = '<div class="loading">加载中</div>';
        const data = await apiCall('/servers');
        state.servers = data.servers || [];
        renderServers();
    } catch (error) {
        elements.serversList.innerHTML = '<div class="empty-state"><h3>加载失败</h3></div>';
    }
}

// 渲染服务器列表
function renderServers() {
    if (state.servers.length === 0) {
        elements.serversList.innerHTML = `
            <div class="empty-state">
                <h3>📭 暂无服务器</h3>
                <p>点击右上角"添加服务器"按钮开始</p>
            </div>
        `;
        return;
    }

    elements.serversList.innerHTML = state.servers.map(server => `
        <div class="card">
            <div class="card-header">
                <div class="card-title">🖥️ ${server.name}</div>
            </div>
            <div class="card-body">
                <div class="card-info">
                    <div class="card-info-item">
                        <span class="card-info-label">IP 地址:</span>
                        <span class="card-info-value">${server.host}</span>
                    </div>
                    <div class="card-info-item">
                        <span class="card-info-label">端口:</span>
                        <span class="card-info-value">${server.port}</span>
                    </div>
                    <div class="card-info-item">
                        <span class="card-info-label">用户名:</span>
                        <span class="card-info-value">${server.username}</span>
                    </div>
                    <div class="card-info-item">
                        <span class="card-info-label">添加时间:</span>
                        <span class="card-info-value">${formatDate(server.createdAt)}</span>
                    </div>
                </div>
            </div>
            <div class="card-actions">
                <button class="btn btn-info" onclick="testServer('${server.id}')">测试连接</button>
                <button class="btn btn-secondary" onclick="getServerInfo('${server.id}')">系统信息</button>
                <button class="btn btn-danger" onclick="deleteServer('${server.id}')">删除</button>
            </div>
        </div>
    `).join('');
}

// 添加服务器
async function handleAddServer(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    try {
        await apiCall('/servers', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        elements.addServerModal.style.display = 'none';
        alert('服务器添加成功');
        loadServers();
    } catch (error) {
        // Error already handled in apiCall
    }
}

// 测试服务器连接
async function testServer(serverId) {
    try {
        const result = await apiCall(`/servers/${serverId}/test`, {
            method: 'POST'
        });
        alert(result.message);
    } catch (error) {
        // Error already handled in apiCall
    }
}

// 获取服务器信息
async function getServerInfo(serverId) {
    try {
        const result = await apiCall(`/servers/${serverId}/info`);
        const info = result.info;
        
        alert(`系统信息:
操作系统: ${info.os}
内核版本: ${info.kernel}
架构: ${info.arch}
CPU: ${info.cpu}
内存: ${info.memory}
磁盘: ${info.disk}`);
    } catch (error) {
        // Error already handled in apiCall
    }
}

// 删除服务器
async function deleteServer(serverId) {
    if (!confirm('确定要删除此服务器吗？')) {
        return;
    }

    try {
        await apiCall(`/servers/${serverId}`, {
            method: 'DELETE'
        });
        alert('服务器删除成功');
        loadServers();
    } catch (error) {
        // Error already handled in apiCall
    }
}

// 加载实例列表
async function loadInstances() {
    try {
        elements.instancesList.innerHTML = '<div class="loading">加载中</div>';
        const data = await apiCall('/soga/instances');
        state.instances = data.instances || [];
        renderInstances();
    } catch (error) {
        elements.instancesList.innerHTML = '<div class="empty-state"><h3>加载失败</h3></div>';
    }
}

// 渲染实例列表
function renderInstances() {
    if (state.instances.length === 0) {
        elements.instancesList.innerHTML = `
            <div class="empty-state">
                <h3>📭 暂无实例</h3>
                <p>点击右上角"创建实例"按钮开始</p>
            </div>
        `;
        return;
    }

    elements.instancesList.innerHTML = state.instances.map(instance => {
        const server = state.servers.find(s => s.id === instance.serverId);
        const serverName = server ? server.name : '未知服务器';
        
        return `
            <div class="card">
                <div class="card-header">
                    <div class="card-title">⚡ ${instance.name}</div>
                    <span class="status-badge status-${instance.status === 'running' ? 'active' : 'inactive'}">
                        ${instance.status === 'running' ? '运行中' : '已停止'}
                    </span>
                </div>
                <div class="card-body">
                    <div class="card-info">
                        <div class="card-info-item">
                            <span class="card-info-label">服务器:</span>
                            <span class="card-info-value">${serverName}</span>
                        </div>
                        <div class="card-info-item">
                            <span class="card-info-label">面板类型:</span>
                            <span class="card-info-value">${instance.config.panelType}</span>
                        </div>
                        <div class="card-info-item">
                            <span class="card-info-label">节点 ID:</span>
                            <span class="card-info-value">${instance.config.nodeId}</span>
                        </div>
                        <div class="card-info-item">
                            <span class="card-info-label">创建时间:</span>
                            <span class="card-info-value">${formatDate(instance.createdAt)}</span>
                        </div>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn btn-success" onclick="startInstance('${instance.serverId}', '${instance.name}')">启动</button>
                    <button class="btn btn-warning" onclick="stopInstance('${instance.serverId}', '${instance.name}')">停止</button>
                    <button class="btn btn-info" onclick="restartInstance('${instance.serverId}', '${instance.name}')">重启</button>
                    <button class="btn btn-secondary" onclick="viewLogs('${instance.serverId}', '${instance.name}')">日志</button>
                    <button class="btn btn-danger" onclick="deleteInstance('${instance.serverId}', '${instance.name}')">删除</button>
                </div>
            </div>
        `;
    }).join('');
}

// 加载服务器选择框
function loadServerSelect() {
    const select = document.getElementById('server-select');
    select.innerHTML = '<option value="">请选择服务器</option>' +
        state.servers.map(server => 
            `<option value="${server.id}">${server.name} (${server.host})</option>`
        ).join('');
}

// 创建实例
async function handleCreateInstance(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    // 构建配置对象
    const config = {
        panelType: data.panelType,
        panelUrl: data.panelUrl,
        panelKey: data.panelKey,
        nodeId: data.nodeId,
        certDomain: data.certDomain,
        certFile: data.certFile,
        keyFile: data.keyFile,
        logLevel: data.logLevel,
        checkInterval: parseInt(data.checkInterval),
        userConnLimit: parseInt(data.userConnLimit),
        userSpeedLimit: parseInt(data.userSpeedLimit),
        enableDNS: data.enableDNS === 'on'
    };

    // 处理安装模式
    const installMode = data.installMode || 'online';
    if (installMode === 'online') {
        // 在线模式：使用版本号
        config.offlineMode = false;
        if (data.sogaVersion) {
            config.sogaVersion = data.sogaVersion;
        }
    } else if (installMode === 'offline-saved') {
        // 离线模式：使用已保存的离线包
        const savedPackageSelect = document.getElementById('saved-package-select');
        const packageId = savedPackageSelect.value;

        if (!packageId) {
            alert('请选择已保存的离线包');
            return;
        }

        // 从服务器获取离线包内容
        try {
            const result = await apiCall(`/soga/packages/${packageId}/content`);
            config.offlineMode = true;
            config.sogaPackage = result.content;
        } catch (error) {
            alert('获取离线包失败，请重试');
            return;
        }
    } else if (installMode === 'offline-upload') {
        // 离线模式：临时上传文件
        const fileInput = document.getElementById('soga-file-input');
        const file = fileInput.files[0];

        if (!file) {
            alert('请选择 Soga 文件');
            return;
        }

        // 读取文件并转换为 base64
        try {
            const fileBase64 = await fileToBase64(file);
            config.offlineMode = true;
            config.sogaPackage = fileBase64;
        } catch (error) {
            alert('文件读取失败: ' + error.message);
            return;
        }
    }

    // 处理路由配置
    if (data.routeConfig) {
        config.routeConfig = data.routeConfig;
    }

    // 处理黑名单
    if (data.blockList) {
        config.blockList = data.blockList;
    }

    try {
        await apiCall('/soga/install', {
            method: 'POST',
            body: JSON.stringify({
                serverId: data.serverId,
                instanceName: data.instanceName,
                config: config
            })
        });

        elements.createInstanceModal.style.display = 'none';
        alert('实例创建成功，正在启动...');
        loadInstances();
    } catch (error) {
        // Error already handled in apiCall
    }
}

// 文件转 Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // 提取 base64 部分（去除 data:xxx;base64, 前缀）
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// 启动实例
async function startInstance(serverId, instanceName) {
    try {
        const result = await apiCall(`/soga/${serverId}/${instanceName}/start`, {
            method: 'POST'
        });
        alert(result.message);
        loadInstances();
    } catch (error) {
        // Error already handled in apiCall
    }
}

// 停止实例
async function stopInstance(serverId, instanceName) {
    try {
        const result = await apiCall(`/soga/${serverId}/${instanceName}/stop`, {
            method: 'POST'
        });
        alert(result.message);
        loadInstances();
    } catch (error) {
        // Error already handled in apiCall
    }
}

// 重启实例
async function restartInstance(serverId, instanceName) {
    try {
        const result = await apiCall(`/soga/${serverId}/${instanceName}/restart`, {
            method: 'POST'
        });
        alert(result.message);
        loadInstances();
    } catch (error) {
        // Error already handled in apiCall
    }
}

// 查看日志
async function viewLogs(serverId, instanceName) {
    state.currentServer = serverId;
    state.currentInstance = instanceName;
    elements.logsModal.style.display = 'block';
    await loadLogs(serverId, instanceName);
}

// 加载日志
async function loadLogs(serverId, instanceName) {
    try {
        document.getElementById('logs-content').textContent = '加载中...';
        const result = await apiCall(`/soga/${serverId}/${instanceName}/logs?lines=200`);
        document.getElementById('logs-content').textContent = result.logs || '暂无日志';
    } catch (error) {
        document.getElementById('logs-content').textContent = '加载日志失败';
    }
}

// 删除实例
async function deleteInstance(serverId, instanceName) {
    if (!confirm(`确定要删除实例 ${instanceName} 吗？此操作将停止服务并删除所有配置文件。`)) {
        return;
    }

    try {
        const result = await apiCall(`/soga/${serverId}/${instanceName}`, {
            method: 'DELETE'
        });
        alert(result.message);
        loadInstances();
    } catch (error) {
        // Error already handled in apiCall
    }
}

// 工具函数：格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ==================== 离线包管理 ====================

// 加载离线包列表
async function loadPackages() {
    try {
        const data = await apiCall('/soga/packages');
        state.packages = data.packages || [];
        renderPackages();
    } catch (error) {
        // Error already handled in apiCall
    }
}

// 渲染离线包列表
function renderPackages() {
    if (!elements.packagesList) return;

    if (state.packages.length === 0) {
        elements.packagesList.innerHTML = `
            <div class="empty-state">
                <p>还没有上传离线包</p>
                <p>点击"上传离线包"按钮来添加</p>
            </div>
        `;
        return;
    }

    elements.packagesList.innerHTML = state.packages.map(pkg => `
        <div class="card">
            <div class="card-header">
                <h3>${pkg.name}</h3>
                <div class="card-actions">
                    <button class="btn btn-sm btn-danger" onclick="deletePackage('${pkg.id}')">删除</button>
                </div>
            </div>
            <div class="card-body">
                <div class="info-row">
                    <span class="label">架构:</span>
                    <span class="value">${pkg.arch}</span>
                </div>
                <div class="info-row">
                    <span class="label">文件大小:</span>
                    <span class="value">${formatSize(pkg.size)}</span>
                </div>
                ${pkg.description ? `
                <div class="info-row">
                    <span class="label">描述:</span>
                    <span class="value">${pkg.description}</span>
                </div>
                ` : ''}
                <div class="info-row">
                    <span class="label">上传时间:</span>
                    <span class="value">${formatDate(pkg.createdAt)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// 上传离线包
elements.uploadPackageBtn?.addEventListener('click', () => {
    elements.uploadPackageModal.style.display = 'block';
});

document.getElementById('cancel-upload-package-btn')?.addEventListener('click', () => {
    elements.uploadPackageModal.style.display = 'none';
    elements.uploadPackageForm.reset();
});

elements.uploadPackageForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const name = formData.get('name');
    const arch = formData.get('arch');
    const description = formData.get('description');
    const fileInput = document.getElementById('package-file-input');

    if (!fileInput.files[0]) {
        alert('请选择文件');
        return;
    }

    try {
        const fileBase64 = await fileToBase64(fileInput.files[0]);

        await apiCall('/soga/packages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                arch,
                fileBase64,
                description
            })
        });

        alert('离线包上传成功！');
        elements.uploadPackageModal.style.display = 'none';
        elements.uploadPackageForm.reset();
        loadPackages();
    } catch (error) {
        // Error already handled in apiCall
    }
});

// 删除离线包
async function deletePackage(id) {
    if (!confirm('确定要删除此离线包吗？')) {
        return;
    }

    try {
        await apiCall(`/soga/packages/${id}`, {
            method: 'DELETE'
        });
        alert('离线包删除成功');
        loadPackages();
    } catch (error) {
        // Error already handled in apiCall
    }
}

// 格式化文件大小
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}
