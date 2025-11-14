const API_BASE = '/api';

// API 日志收集
const apiLogs = [];
const MAX_LOGS = 100;

function addApiLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
    const logEntry = {
        timestamp,
        message,
        type,
        fullText: `[${timestamp}] [${type.toUpperCase()}] ${message}`
    };

    apiLogs.push(logEntry);

    // 限制日志数量
    if (apiLogs.length > MAX_LOGS) {
        apiLogs.shift();
    }

    // 更新日志显示
    updateLogViewer();
}

function updateLogViewer() {
    const logContent = document.getElementById('api-logs-content');
    const logCount = document.getElementById('log-count');

    if (logContent) {
        logContent.textContent = apiLogs.map(log => log.fullText).join('\n');
        // 自动滚动到底部
        logContent.parentElement.scrollTop = logContent.parentElement.scrollHeight;
    }

    if (logCount) {
        logCount.textContent = apiLogs.length;
    }
}

function toggleLogViewer(event) {
    // 阻止事件冒泡，防止触发外部点击关闭
    if (event) {
        event.stopPropagation();
    }

    const modal = document.getElementById('log-viewer-modal');
    if (modal) {
        modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
        updateLogViewer();
    }
}

function clearApiLogs() {
    apiLogs.length = 0;
    updateLogViewer();
}

function copyApiLogs() {
    const logsText = apiLogs.map(log => log.fullText).join('\n');
    navigator.clipboard.writeText(logsText).then(() => {
        alert('日志已复制到剪贴板');
    }).catch(err => {
        console.error('复制失败:', err);
        alert('复制失败，请手动选择并复制');
    });
}

// 状态管理
const state = {
    servers: [],
    instances: [],
    packages: [],
    routeConfigs: [],
    currentPage: 'servers',
    currentView: 'grid', // grid or list
    currentSize: 'medium', // small, medium, large
    currentServer: null,
    currentInstance: null,
    currentDiagnose: null
};

// DOM 元素
const elements = {
    // 导航
    navItems: document.querySelectorAll('.nav-item'),
    pageTitle: document.getElementById('page-title'),
    logoutBtn: document.getElementById('logout-btn'),
    // 视图控制
    viewBtns: document.querySelectorAll('.view-btn'),
    sizeBtns: document.querySelectorAll('.size-btn'),
    sizeSwitcher: document.getElementById('size-switcher'),
    // 列表容器
    serversList: document.getElementById('servers-list'),
    instancesList: document.getElementById('instances-list'),
    packagesList: document.getElementById('packages-list'),
    routesList: document.getElementById('routes-list'),
    // 按钮
    addServerBtn: document.getElementById('add-server-btn'),
    createInstanceBtn: document.getElementById('create-instance-btn'),
    uploadPackageBtn: document.getElementById('upload-package-btn'),
    addRouteConfigBtn: document.getElementById('add-route-config-btn'),
    // 模态框
    addServerModal: document.getElementById('add-server-modal'),
    addServerForm: document.getElementById('add-server-form'),
    createInstanceModal: document.getElementById('create-instance-modal'),
    createInstanceForm: document.getElementById('create-instance-form'),
    uploadPackageModal: document.getElementById('upload-package-modal'),
    uploadPackageForm: document.getElementById('upload-package-form'),
    addRouteConfigModal: document.getElementById('add-route-config-modal'),
    addRouteConfigForm: document.getElementById('add-route-config-form'),
    logsModal: document.getElementById('logs-modal'),
    diagnoseModal: document.getElementById('diagnose-modal'),
    // 表单控件
    authTypeSelect: document.getElementById('auth-type'),
    passwordGroup: document.getElementById('password-group'),
    keyGroup: document.getElementById('key-group')
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initViewSwitcher();
    initSizeSwitcher();
    initModals();
    initAuthTypeSwitch();
    initInstallModeSwitch();
    initLogout();
    loadServers();
    loadInstances();
    loadPackages();
    loadRouteConfigs();
});

// ==================== 导航系统 ====================

function initNavigation() {
    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            switchPage(page);
        });
    });
}

function switchPage(page) {
    state.currentPage = page;

    // 更新导航激活状态
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // 更新页面内容显示
    document.querySelectorAll('.page-content').forEach(content => {
        content.classList.toggle('active', content.id === `${page}-page`);
    });

    // 更新页面标题
    const pageTitles = {
        'servers': '服务器管理',
        'instances': '实例管理',
        'packages': '离线包管理',
        'routes': '路由配置'
    };

    if (elements.pageTitle) {
        elements.pageTitle.textContent = pageTitles[page] || '';
    }

    addApiLog(`切换到页面: ${pageTitles[page]}`, 'info');
}

// ==================== 视图切换 ====================

function initViewSwitcher() {
    elements.viewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchView(view);
        });
    });
}

function switchView(view) {
    state.currentView = view;

    // 更新视图按钮激活状态
    elements.viewBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    // 更新所有卡片容器的视图类
    document.querySelectorAll('.cards-container').forEach(container => {
        container.classList.remove('view-grid', 'view-list');
        container.classList.add(`view-${view}`);
    });

    // 列表视图时隐藏尺寸切换器
    if (elements.sizeSwitcher) {
        elements.sizeSwitcher.style.display = view === 'grid' ? 'flex' : 'none';
    }

    addApiLog(`切换视图: ${view === 'grid' ? '方块视图' : '列表视图'}`, 'info');
}

// ==================== 尺寸切换 ====================

function initSizeSwitcher() {
    elements.sizeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const size = btn.dataset.size;
            switchSize(size);
        });
    });
}

function switchSize(size) {
    state.currentSize = size;

    // 更新尺寸按钮激活状态
    elements.sizeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.size === size);
    });

    // 更新所有卡片容器的尺寸类
    document.querySelectorAll('.cards-container').forEach(container => {
        container.classList.remove('size-small', 'size-medium', 'size-large');
        container.classList.add(`size-${size}`);
    });

    const sizeNames = { 'small': '小', 'medium': '中', 'large': '大' };
    addApiLog(`切换尺寸: ${sizeNames[size]}`, 'info');
}

// ==================== 登出功能 ====================

function initLogout() {
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', handleLogout);
    }
}

function handleLogout() {
    if (confirm('确定要退出登录吗？')) {
        localStorage.removeItem('authToken');
        addApiLog('用户已登出', 'info');
        window.location.href = '/login.html';
    }
}

// ==================== 下拉菜单功能 ====================

function toggleDropdown(event) {
    event.preventDefault();
    event.stopPropagation();

    const dropdown = event.target.closest('.dropdown');
    const isOpen = dropdown.classList.contains('open');

    // 关闭所有其他下拉菜单
    document.querySelectorAll('.dropdown.open').forEach(d => {
        d.classList.remove('open');
    });

    // 切换当前下拉菜单
    if (!isOpen) {
        dropdown.classList.add('open');
    }
}

// 点击页面其他地方关闭所有下拉菜单
document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown.open').forEach(d => {
            d.classList.remove('open');
        });
    }
});

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
async function apiCall(endpoint, options = {}, showErrorAlert = true) {
    let response;
    const method = options.method || 'GET';

    try {
        // 使用 AuthManager 获取认证头
        const authHeaders = AuthManager.getAuthHeaders();

        console.log(`[API] 请求: ${method} ${endpoint}`);
        addApiLog(`请求: ${method} ${endpoint}`, 'info');

        // 调试：检查是否有 Authorization 头
        const finalHeaders = {
            ...authHeaders,
            ...options.headers
        };
        const hasAuth = finalHeaders.Authorization || finalHeaders.authorization;
        console.log(`[API] Authorization 头存在: ${!!hasAuth}`);
        if (!hasAuth) {
            console.error('[API] 警告：请求缺少 Authorization 头！');
            addApiLog('警告：请求缺少 Authorization 头', 'error');
        }

        // 从 options 中移除 headers，避免被 ...options 覆盖
        const { headers: _, ...restOptions } = options;

        response = await fetch(`${API_BASE}${endpoint}`, {
            ...restOptions,
            headers: finalHeaders
        });

        console.log(`[API] 响应状态: ${response.status}`);
        addApiLog(`响应状态: ${response.status}`, response.ok ? 'info' : 'warn');

        // 尝试解析 JSON
        let data;
        try {
            const contentType = response.headers.get('content-type');
            console.log(`[API] Content-Type: ${contentType}`);
            addApiLog(`Content-Type: ${contentType || '无'}`, 'info');

            data = await response.json();
        } catch (jsonError) {
            console.error('[API] JSON 解析失败:', jsonError);
            addApiLog(`JSON 解析失败: ${jsonError.message}`, 'error');
            // 如果响应不是 JSON，可能是网络错误或服务器错误
            if (!response.ok) {
                const errorMsg = `服务器错误 (${response.status}): ${response.statusText}`;
                addApiLog(errorMsg, 'error');
                throw new Error(errorMsg);
            }
            addApiLog('响应格式错误（非 JSON）', 'error');
            throw new Error('响应格式错误');
        }

        // 检查 401 状态（解析 JSON 后才能获取详细信息）
        if (response.status === 401) {
            const debugInfo = data.debug || data.error || '未知原因';
            console.warn('[API] 401 未授权:', debugInfo);
            addApiLog(`401 未授权: ${debugInfo}`, 'error');

            // 记录完整的 401 响应数据
            if (data.debug) {
                addApiLog(`详细信息: ${data.debug}`, 'error');
            }

            addApiLog('执行登出...', 'warn');
            AuthManager.logout();
            throw new Error('未授权，请重新登录');
        }

        if (!response.ok) {
            console.error('[API] 请求失败:', data);
            const errorMsg = data.error || data.message || '请求失败';
            addApiLog(`请求失败: ${errorMsg}`, 'error');

            // 创建包含完整数据的错误对象
            const error = new Error(errorMsg);
            error.data = data; // 保存完整的响应数据（包括 logs）
            error.status = response.status; // 保存状态码
            throw error;
        }

        console.log(`[API] 请求成功`);
        addApiLog(`请求成功`, 'success');
        return data;
    } catch (error) {
        // 网络错误或 fetch 本身失败
        if (!response) {
            console.error('[API] 网络错误或请求失败:', error);
            addApiLog(`网络错误: ${error.message}`, 'error');
            if (showErrorAlert) {
                alert(`网络错误: ${error.message}`);
            }
            throw error;
        }

        console.error('[API] 处理错误:', error);
        // 只在需要显示错误且非 401 错误时显示 alert
        if (showErrorAlert && !error.message.includes('未授权')) {
            alert(`错误: ${error.message}`);
        }
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
                        <span class="card-info-label">SSH 连接:</span>
                        <span class="card-info-value" style="font-family: monospace; font-size: 12px;">ssh ${server.username}@${server.host} -p ${server.port}</span>
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
                <button class="btn btn-warning" onclick="diagnoseServer('${server.id}')">🔍 诊断 Soga</button>
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
                    <div class="dropdown">
                        <button class="dropdown-toggle" onclick="toggleDropdown(event)">
                            操作
                        </button>
                        <div class="dropdown-menu">
                            <button class="success" onclick="startInstance('${instance.serverId}', '${instance.name}')">▶️ 启动</button>
                            <button class="warning" onclick="stopInstance('${instance.serverId}', '${instance.name}')">⏸️ 停止</button>
                            <button class="info" onclick="restartInstance('${instance.serverId}', '${instance.name}')">🔄 重启</button>
                            <button onclick="viewLogs('${instance.serverId}', '${instance.name}')">📋 查看日志</button>
                            <button class="danger" onclick="deleteInstance('${instance.serverId}', '${instance.name}')">🗑️ 删除实例</button>
                        </div>
                    </div>
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
        serverType: data.serverType,  // 后端类型（v2ray, trojan, ss等）
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

        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
        console.log(`准备安装 Soga: ${file.name}, 大小: ${fileSizeMB} MB`);
        addApiLog(`准备安装 Soga: ${file.name}, 大小: ${fileSizeMB} MB`, 'info');

        // 读取文件并转换为 base64
        try {
            addApiLog('正在读取 Soga 文件并转换为 Base64...', 'info');
            const fileBase64 = await fileToBase64(file);
            const base64SizeMB = (fileBase64.length / 1024 / 1024).toFixed(2);

            console.log(`文件转换完成, Base64 大小: ${base64SizeMB} MB`);
            addApiLog(`文件转换完成, Base64 大小: ${base64SizeMB} MB, 准备上传并安装`, 'success');

            config.offlineMode = true;
            config.sogaPackage = fileBase64;
        } catch (error) {
            addApiLog(`文件读取失败: ${error.message}`, 'error');
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
        console.log(`开始安装实例: ${data.instanceName}, 模式: ${installMode}`);
        addApiLog(`开始安装实例: ${data.instanceName}, 模式: ${installMode}`, 'info');

        await apiCall('/soga/install', {
            method: 'POST',
            body: JSON.stringify({
                serverId: data.serverId,
                instanceName: data.instanceName,
                config: config
            })
        });

        addApiLog(`实例 ${data.instanceName} 安装成功`, 'success');
        elements.createInstanceModal.style.display = 'none';
        alert('实例创建成功，正在启动...');
        loadInstances();
    } catch (error) {
        addApiLog(`实例 ${data.instanceName} 安装失败: ${error.message}`, 'error');

        // 如果错误包含安装日志，显示日志模态框
        if (error.data && error.data.logs) {
            showInstallLogs(error.data.logs, error.message);
        } else {
            // 没有详细日志时，提醒用户查看API日志
            if (!error.message.includes('未授权')) {
                alert(`安装失败: ${error.message}\n\n详细信息请查看 API 日志（点击右下角📋按钮）`);
            }
        }
        // Error already handled in apiCall with alert
    }
}

// 显示安装日志模态框
function showInstallLogs(logs, errorMessage) {
    const modal = document.getElementById('install-logs-modal');
    const content = document.getElementById('install-logs-content');

    if (modal && content) {
        // 显示错误消息和完整日志
        let logsText = `===== 安装失败 =====\n错误: ${errorMessage}\n\n===== 详细安装日志 =====\n${logs}\n`;
        content.textContent = logsText;
        modal.style.display = 'block';

        // 保存日志到全局变量以便复制
        window.currentInstallLogs = logsText;
    }
}

// 复制安装日志
function copyInstallLogs() {
    const logsText = window.currentInstallLogs || document.getElementById('install-logs-content').textContent;
    navigator.clipboard.writeText(logsText).then(() => {
        alert('日志已复制到剪贴板');
    }).catch(err => {
        console.error('复制失败:', err);
        alert('复制失败，请手动选择并复制');
    });
}

// 关闭安装日志模态框
function closeInstallLogsModal() {
    const modal = document.getElementById('install-logs-modal');
    if (modal) {
        modal.style.display = 'none';
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
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;

    if (!fileInput.files[0]) {
        alert('请选择文件');
        return;
    }

    // 检查文件大小（建议不超过 100MB）
    const file = fileInput.files[0];
    const fileSizeMB = file.size / 1024 / 1024;

    console.log(`准备上传文件: ${file.name}, 大小: ${fileSizeMB.toFixed(2)} MB`);
    addApiLog(`准备上传离线包: ${file.name}, 大小: ${fileSizeMB.toFixed(2)} MB`, 'info');

    if (fileSizeMB > 100) {
        const msg = `文件大小为 ${fileSizeMB.toFixed(2)} MB，上传可能需要较长时间（预计 ${Math.ceil(fileSizeMB / 2)} 分钟）。是否继续？`;
        if (!confirm(msg)) {
            return;
        }
    }

    try {
        // 禁用提交按钮，显示上传进度
        submitBtn.disabled = true;
        submitBtn.textContent = `正在读取文件 (${fileSizeMB.toFixed(2)} MB)...`;

        console.log('开始读取文件并转换为 Base64...');
        addApiLog('开始读取文件并转换为 Base64...', 'info');

        const fileBase64 = await fileToBase64(file);
        const base64SizeMB = (fileBase64.length / 1024 / 1024).toFixed(2);

        console.log(`文件转换完成, Base64 大小: ${base64SizeMB} MB`);
        addApiLog(`文件转换完成, Base64 大小: ${base64SizeMB} MB`, 'success');

        submitBtn.textContent = `正在上传到服务器 (${base64SizeMB} MB)...`;

        console.log('开始上传到服务器...');
        addApiLog('开始上传到服务器，请耐心等待...', 'info');

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

        console.log('离线包上传成功！');
        addApiLog('离线包上传成功！', 'success');
        alert('离线包上传成功！');
        elements.uploadPackageModal.style.display = 'none';
        elements.uploadPackageForm.reset();
        loadPackages();
    } catch (error) {
        // Error already handled in apiCall
        console.error('上传离线包失败:', error);
        addApiLog(`上传离线包失败: ${error.message}`, 'error');

        // 如果不是401错误（401已经自动登出），显示详细错误信息
        if (!error.message.includes('未授权')) {
            const errorDetail = error.data ? JSON.stringify(error.data, null, 2) : error.message;
            alert(`上传失败: ${error.message}\n\n详细信息请查看 API 日志（点击右下角📋按钮）`);
        }
    } finally {
        // 恢复按钮状态
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
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

// ==================== 路由配置管理 ====================

// 加载路由配置列表
async function loadRouteConfigs() {
    try {
        const data = await apiCall('/route-configs');
        state.routeConfigs = data.configs || [];
        renderRouteConfigs();
        updateRouteConfigSelects();
    } catch (error) {
        console.error('加载路由配置失败:', error);
        // 显示空状态
        state.routeConfigs = [];
        renderRouteConfigs();
        updateRouteConfigSelects();
    }
}

// 渲染路由配置列表
function renderRouteConfigs() {
    if (!elements.routesList) return;

    if (state.routeConfigs.length === 0) {
        elements.routesList.innerHTML = `
            <div class="empty-state">
                <h3>📋 还没有路由配置模板</h3>
                <p>点击"添加路由配置"按钮来创建模板</p>
                <p style="margin-top: 10px; color: #666; font-size: 0.9em;">
                    路由配置模板可以让您在创建实例时快速选择预设的路由规则，<br>
                    避免每次手动输入相同的配置
                </p>
            </div>
        `;
        return;
    }

    elements.routesList.innerHTML = state.routeConfigs.map(config => `
        <div class="card">
            <div class="card-header">
                <div class="card-title">
                    <span class="card-title">${config.name}</span>
                    ${config.isDefault ? '<span class="status-badge status-active">默认</span>' : ''}
                </div>
                <div class="card-actions">
                    ${!config.isDefault ? `<button class="btn btn-sm btn-success" onclick="setDefaultRouteConfig('${config.id}')">设为默认</button>` : ''}
                    <button class="btn btn-sm btn-secondary" onclick="viewRouteConfig('${config.id}')">查看</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteRouteConfig('${config.id}')">删除</button>
                </div>
            </div>
            <div class="card-body">
                <div class="card-info">
                    ${config.description ? `
                    <div class="card-info-item">
                        <span class="card-info-label">描述:</span>
                        <span class="card-info-value">${config.description}</span>
                    </div>
                    ` : ''}
                    <div class="card-info-item">
                        <span class="card-info-label">路由规则:</span>
                        <span class="card-info-value">${config.routeConfig ? (config.routeConfig.length > 50 ? config.routeConfig.substring(0, 50) + '...' : config.routeConfig) : '未设置'}</span>
                    </div>
                    <div class="card-info-item">
                        <span class="card-info-label">黑名单:</span>
                        <span class="card-info-value">${config.blockList ? '已设置' : '未设置'}</span>
                    </div>
                    <div class="card-info-item">
                        <span class="card-info-label">创建时间:</span>
                        <span class="card-info-value">${formatDate(config.createdAt)}</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// 更新创建实例表单中的路由配置选择器
function updateRouteConfigSelects() {
    // 在创建实例表单的路由配置部分添加选择器
    const routeConfigGroup = document.querySelector('textarea[name="routeConfig"]')?.closest('.form-group');
    if (!routeConfigGroup) return;

    // 检查是否已经添加了选择器
    let selectWrapper = routeConfigGroup.querySelector('.route-config-selector');
    if (!selectWrapper) {
        selectWrapper = document.createElement('div');
        selectWrapper.className = 'route-config-selector';
        selectWrapper.style.marginBottom = '10px';
        routeConfigGroup.insertBefore(selectWrapper, routeConfigGroup.firstChild.nextSibling);
    }

    const defaultConfig = state.routeConfigs.find(c => c.isDefault);

    selectWrapper.innerHTML = `
        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #555;">快速选择模板</label>
        <select id="route-config-template-select" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 6px; font-size: 14px; margin-bottom: 5px;">
            <option value="">不使用模板（手动输入）</option>
            ${state.routeConfigs.map(config => `
                <option value="${config.id}" ${config.isDefault ? 'selected' : ''}>
                    ${config.name}${config.isDefault ? ' (默认)' : ''}
                </option>
            `).join('')}
        </select>
        <small style="display: block; margin-top: 5px; color: #999; font-size: 12px;">
            选择预设模板后，路由规则和黑名单将自动填充（可修改）
        </small>
    `;

    // 添加选择器事件监听
    const templateSelect = document.getElementById('route-config-template-select');
    if (templateSelect) {
        templateSelect.addEventListener('change', (e) => {
            const configId = e.target.value;
            if (configId) {
                const config = state.routeConfigs.find(c => c.id === configId);
                if (config) {
                    const routeTextarea = document.querySelector('textarea[name="routeConfig"]');
                    const blockListTextarea = document.querySelector('textarea[name="blockList"]');
                    if (routeTextarea) routeTextarea.value = config.routeConfig || '';
                    if (blockListTextarea) blockListTextarea.value = config.blockList || '';
                    addApiLog(`已加载路由配置模板: ${config.name}`, 'info');
                }
            }
        });

        // 如果有默认配置，自动加载
        if (defaultConfig && !document.querySelector('textarea[name="routeConfig"]').value) {
            templateSelect.value = defaultConfig.id;
            templateSelect.dispatchEvent(new Event('change'));
        }
    }
}

// 添加路由配置按钮事件
elements.addRouteConfigBtn?.addEventListener('click', () => {
    elements.addRouteConfigModal.style.display = 'block';
});

// 取消按钮
document.getElementById('cancel-route-config-btn')?.addEventListener('click', () => {
    elements.addRouteConfigModal.style.display = 'none';
    elements.addRouteConfigForm.reset();
});

// 提交路由配置表单
elements.addRouteConfigForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const configData = {
        name: formData.get('name'),
        routeConfig: formData.get('routeConfig'),
        blockList: formData.get('blockList') || '',
        description: formData.get('description') || '',
        isDefault: formData.get('isDefault') === 'on'
    };

    try {
        // 调用 API 保存
        await apiCall('/route-configs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(configData)
        });

        addApiLog('路由配置保存成功', 'success');
        alert('路由配置保存成功');
        elements.addRouteConfigModal.style.display = 'none';
        elements.addRouteConfigForm.reset();
        loadRouteConfigs();
    } catch (error) {
        console.error('保存路由配置失败:', error);
        addApiLog(`保存路由配置失败: ${error.message}`, 'error');
    }
});

// 设置默认路由配置
async function setDefaultRouteConfig(id) {
    try {
        // 调用 API 设置默认
        await apiCall(`/route-configs/${id}/set-default`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        addApiLog('默认配置已更新', 'success');
        alert('默认配置已更新');
        loadRouteConfigs();
    } catch (error) {
        console.error('设置默认配置失败:', error);
        addApiLog(`设置默认配置失败: ${error.message}`, 'error');
    }
}

// 查看路由配置详情
function viewRouteConfig(id) {
    const config = state.routeConfigs.find(c => c.id === id);
    if (!config) {
        alert('配置不存在');
        return;
    }

    const details = `
路由配置: ${config.name}
${config.isDefault ? '[默认配置]' : ''}

描述: ${config.description || '无'}

=== 路由规则 (route.toml) ===
${config.routeConfig || '未设置'}

=== 黑名单 (blocklist) ===
${config.blockList || '未设置'}

创建时间: ${formatDate(config.createdAt)}
    `.trim();

    alert(details);
}

// 删除路由配置
async function deleteRouteConfig(id) {
    if (!confirm('确定要删除此路由配置吗？')) {
        return;
    }

    try {
        // 调用 API 删除
        await apiCall(`/route-configs/${id}`, {
            method: 'DELETE'
        });

        alert('路由配置删除成功');
        loadRouteConfigs();
    } catch (error) {
        console.error('删除路由配置失败:', error);
        addApiLog(`删除路由配置失败: ${error.message}`, 'error');
    }
}

// ==================== 诊断功能 ====================

// 诊断服务器上的 Soga 实例
async function diagnoseServer(serverId, instanceName = null) {
    // 如果没有指定实例名，弹出输入框
    if (!instanceName) {
        instanceName = prompt('请输入要诊断的实例名称:', 'soga-test');
        if (!instanceName) return;
    }

    const server = state.servers.find(s => s.id === serverId);
    if (!server) {
        alert('服务器不存在');
        return;
    }

    try {
        // 显示加载中
        elements.diagnoseModal.style.display = 'block';
        document.getElementById('diagnose-server-name').textContent = server.name;
        document.getElementById('diagnose-instance-name').textContent = instanceName;
        document.getElementById('diagnose-output').textContent = '正在运行诊断脚本...\n请稍候...';

        // 保存当前诊断上下文
        state.currentDiagnose = { serverId, instanceName };

        // 调用诊断 API
        const result = await apiCall(`/servers/${serverId}/diagnose/${instanceName}`, {
            method: 'POST'
        });

        if (result.success) {
            document.getElementById('diagnose-output').textContent = result.output;

            // 如果有错误输出，也显示
            if (result.error) {
                document.getElementById('diagnose-output').textContent += '\n\n=== 错误输出 ===\n' + result.error;
            }

            // 如果退出码不为0，添加警告
            if (result.exitCode !== 0) {
                document.getElementById('diagnose-output').textContent += '\n\n⚠️  诊断脚本退出码: ' + result.exitCode;
            }
        } else {
            document.getElementById('diagnose-output').textContent = '诊断失败: ' + result.error;
        }
    } catch (error) {
        document.getElementById('diagnose-output').textContent = '诊断失败: ' + error.message;
    }
}

// 关闭诊断模态框
document.getElementById('close-diagnose-btn')?.addEventListener('click', () => {
    elements.diagnoseModal.style.display = 'none';
});

// 重新运行诊断
document.getElementById('rerun-diagnose-btn')?.addEventListener('click', () => {
    if (state.currentDiagnose) {
        diagnoseServer(state.currentDiagnose.serverId, state.currentDiagnose.instanceName);
    }
});
