const API_BASE = '/api';

// ==================== 通知框系统 ====================

// Toast 通知
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ'
    };

    const titles = {
        success: '成功',
        error: '错误',
        warning: '警告',
        info: '提示'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <div class="toast-content">
            <div class="toast-title">${titles[type] || titles.info}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // 自动移除
    if (duration > 0) {
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    return toast;
}

// 确认对话框
function showConfirm(message, options = {}) {
    return new Promise((resolve) => {
        const {
            title = '确认操作',
            icon = '❓',
            confirmText = '确定',
            cancelText = '取消',
            danger = false
        } = options;

        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.innerHTML = `
            <div class="confirm-dialog">
                <div class="confirm-icon">${icon}</div>
                <div class="confirm-title">${title}</div>
                <div class="confirm-message">${message}</div>
                <div class="confirm-buttons">
                    <button class="btn btn-cancel">${cancelText}</button>
                    <button class="btn btn-confirm ${danger ? 'danger' : ''}">${confirmText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const confirmBtn = overlay.querySelector('.btn-confirm');
        const cancelBtn = overlay.querySelector('.btn-cancel');

        confirmBtn.onclick = () => {
            overlay.remove();
            resolve(true);
        };

        cancelBtn.onclick = () => {
            overlay.remove();
            resolve(false);
        };

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(false);
            }
        };
    });
}

// Prompt 输入框
function showPrompt(message, options = {}) {
    return new Promise((resolve) => {
        const {
            title = '输入',
            defaultValue = '',
            placeholder = '',
            confirmText = '确定',
            cancelText = '取消'
        } = options;

        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.innerHTML = `
            <div class="confirm-dialog">
                <div class="confirm-title">${title}</div>
                <div class="confirm-message">${message}</div>
                <input type="text" class="prompt-input" placeholder="${placeholder}" value="${defaultValue}" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 6px; margin-bottom: 20px; font-size: 14px;">
                <div class="confirm-buttons">
                    <button class="btn btn-cancel">${cancelText}</button>
                    <button class="btn btn-confirm">${confirmText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const input = overlay.querySelector('.prompt-input');
        const confirmBtn = overlay.querySelector('.btn-confirm');
        const cancelBtn = overlay.querySelector('.btn-cancel');

        input.focus();
        input.select();

        confirmBtn.onclick = () => {
            const value = input.value.trim();
            overlay.remove();
            resolve(value || null);
        };

        cancelBtn.onclick = () => {
            overlay.remove();
            resolve(null);
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                confirmBtn.click();
            } else if (e.key === 'Escape') {
                cancelBtn.click();
            }
        };

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(null);
            }
        };
    });
}

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
    // 版本管理
    currentVersionSpan: document.getElementById('current-version'),
    checkUpdateBtn: document.getElementById('check-update-btn'),
    updateModal: document.getElementById('update-modal'),
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
    initVersionCheck();
    initTemplateManagement(); // 添加模板管理初始化
    initEnhancedEditors(); // 添加高级编辑器初始化
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
                <div class="server-monitor" id="monitor-${server.id}">
                    <div class="monitor-stats">
                        <div class="stat-item">
                            <div class="stat-label">CPU</div>
                            <div class="stat-bar">
                                <div class="stat-bar-fill" style="width: 0%"></div>
                            </div>
                            <div class="stat-value">--</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">内存</div>
                            <div class="stat-bar">
                                <div class="stat-bar-fill" style="width: 0%"></div>
                            </div>
                            <div class="stat-value">--</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">磁盘</div>
                            <div class="stat-bar">
                                <div class="stat-bar-fill" style="width: 0%"></div>
                            </div>
                            <div class="stat-value">--</div>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="showMonitorChart('${server.id}', '${server.name}')" style="margin-top: 10px; width: 100%;">
                        📊 查看详细图表
                    </button>
                </div>
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

    // 加载每个服务器的监控数据
    state.servers.forEach(server => {
        loadServerMonitor(server.id);
    });
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

// ==================== 版本管理 ====================

// 初始化版本检查
function initVersionCheck() {
    // 加载当前版本
    loadCurrentVersion();

    // 检查更新按钮事件
    elements.checkUpdateBtn?.addEventListener('click', checkForUpdates);

    // 开始更新按钮事件
    document.getElementById('start-update-btn')?.addEventListener('click', startUpdate);
}

// 加载当前版本
async function loadCurrentVersion() {
    try {
        const response = await apiCall('/version/current');
        if (response.success && response.version) {
            elements.currentVersionSpan.textContent = response.version.version;
        }
    } catch (error) {
        console.error('加载版本信息失败:', error);
    }
}

// 检查更新
async function checkForUpdates() {
    try {
        const btn = elements.checkUpdateBtn;
        btn.disabled = true;
        btn.innerHTML = '<span style="animation: spin 1s linear infinite; display: inline-block;">🔄</span>';

        const response = await apiCall('/version/check-update');

        if (response.success) {
            if (response.hasUpdate) {
                showUpdateAvailable(response);
            } else {
                showNoUpdate();
            }
        } else {
            throw new Error(response.error || '检查更新失败');
        }
    } catch (error) {
        alert('检查更新失败: ' + error.message);
    } finally {
        elements.checkUpdateBtn.disabled = false;
        elements.checkUpdateBtn.innerHTML = '<span>🔄</span>';
    }
}

// 显示有更新可用
function showUpdateAvailable(updateInfo) {
    // 显示更新模态框
    elements.updateModal.style.display = 'flex';

    // 隐藏所有内容区域
    document.getElementById('update-check-content').style.display = 'block';
    document.getElementById('update-progress-content').style.display = 'none';
    document.getElementById('update-success-content').style.display = 'none';
    document.getElementById('update-no-update-content').style.display = 'none';

    // 填充版本信息
    document.getElementById('update-current-version').textContent = updateInfo.current;
    document.getElementById('update-latest-version').textContent = updateInfo.latest;

    // 填充更新描述
    const descDiv = document.getElementById('update-description');
    if (updateInfo.updateInfo && updateInfo.updateInfo.description) {
        // 将 markdown 转换为 HTML（简单处理）
        const description = updateInfo.updateInfo.description
            .replace(/^### (.*$)/gim, '<h4>$1</h4>')
            .replace(/^## (.*$)/gim, '<h3>$1</h3>')
            .replace(/^# (.*$)/gim, '<h2>$1</h2>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
        descDiv.innerHTML = '<h4>更新内容：</h4>' + description;
    } else {
        descDiv.innerHTML = '<p>新版本已发布，建议更新。</p>';
    }
}

// 显示没有更新
function showNoUpdate() {
    elements.updateModal.style.display = 'flex';

    document.getElementById('update-check-content').style.display = 'none';
    document.getElementById('update-progress-content').style.display = 'none';
    document.getElementById('update-success-content').style.display = 'none';
    document.getElementById('update-no-update-content').style.display = 'block';
}

// 开始更新
async function startUpdate() {
    try {
        // 切换到进度显示
        document.getElementById('update-check-content').style.display = 'none';
        document.getElementById('update-progress-content').style.display = 'block';

        // 清空日志
        document.getElementById('update-logs-content').textContent = '';
        updateProgress(10, '准备更新...');

        // 调用更新 API
        const response = await apiCall('/version/update', { method: 'POST' });

        if (response.success) {
            updateProgress(30, '更新已启动...\n');

            // 模拟进度（因为更新在后台执行）
            let progress = 30;
            const progressInterval = setInterval(() => {
                progress += 10;
                if (progress >= 90) {
                    clearInterval(progressInterval);
                    updateProgress(90, '正在应用更新...\n');

                    // 等待30秒后尝试获取更新日志
                    setTimeout(() => {
                        checkUpdateStatus();
                    }, 5000);
                } else {
                    updateProgress(progress, '');
                }
            }, 2000);
        } else {
            throw new Error(response.error || '启动更新失败');
        }
    } catch (error) {
        document.getElementById('update-logs-content').textContent += '\n错误: ' + error.message;
        updateProgress(0, '更新失败');
    }
}

// 检查更新状态
async function checkUpdateStatus() {
    try {
        const response = await apiCall('/version/update-log');

        if (response.success && response.log) {
            document.getElementById('update-logs-content').textContent += '\n' + response.log;
            updateProgress(100, '更新完成！');

            // 等待2秒后显示成功页面
            setTimeout(() => {
                showUpdateSuccess();
            }, 2000);
        }
    } catch (error) {
        // 如果获取日志失败，可能服务已重启，直接显示成功
        updateProgress(100, '更新完成！');
        setTimeout(() => {
            showUpdateSuccess();
        }, 2000);
    }
}

// 更新进度
function updateProgress(percent, message) {
    const progressBar = document.getElementById('update-progress-bar');
    const progressText = document.getElementById('update-progress-text');
    const logsContent = document.getElementById('update-logs-content');

    progressBar.style.width = percent + '%';
    progressText.textContent = percent + '%';

    if (message) {
        logsContent.textContent += message;
        // 自动滚动到底部
        logsContent.parentElement.scrollTop = logsContent.parentElement.scrollHeight;
    }
}

// 显示更新成功
function showUpdateSuccess() {
    document.getElementById('update-check-content').style.display = 'none';
    document.getElementById('update-progress-content').style.display = 'none';
    document.getElementById('update-success-content').style.display = 'block';

    // 倒计时刷新
    let countdown = 5;
    const countdownSpan = document.getElementById('countdown');
    const countdownInterval = setInterval(() => {
        countdown--;
        countdownSpan.textContent = countdown;
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            location.reload();
        }
    }, 1000);
}

// 关闭更新模态框
function closeUpdateModal() {
    elements.updateModal.style.display = 'none';
}

// 添加关闭按钮事件
elements.updateModal?.querySelector('.close')?.addEventListener('click', closeUpdateModal);

// ==================== 服务器监控 ====================

// 加载服务器监控数据
async function loadServerMonitor(serverId) {
    try {
        const response = await apiCall(`/monitor/${serverId}/stats`, {}, false);

        if (response.success && response.stats) {
            updateMonitorDisplay(serverId, response.stats);
        }
    } catch (error) {
        console.error('加载监控数据失败:', error);
        // 静默失败，不显示错误
    }
}

// 更新监控显示
function updateMonitorDisplay(serverId, stats) {
    const monitorEl = document.getElementById(`monitor-${serverId}`);
    if (!monitorEl) return;

    const statItems = monitorEl.querySelectorAll('.stat-item');

    // CPU
    const cpuBar = statItems[0].querySelector('.stat-bar-fill');
    const cpuValue = statItems[0].querySelector('.stat-value');
    cpuBar.style.width = `${stats.cpu.usage}%`;
    cpuBar.style.backgroundColor = getColorForUsage(stats.cpu.usage);
    cpuValue.textContent = `${stats.cpu.usage}%`;

    // 内存
    const memBar = statItems[1].querySelector('.stat-bar-fill');
    const memValue = statItems[1].querySelector('.stat-value');
    memBar.style.width = `${stats.memory.usage}%`;
    memBar.style.backgroundColor = getColorForUsage(stats.memory.usage);
    memValue.textContent = `${stats.memory.usage}% (${stats.memory.used.toFixed(1)}G/${stats.memory.total.toFixed(1)}G)`;

    // 磁盘
    const diskBar = statItems[2].querySelector('.stat-bar-fill');
    const diskValue = statItems[2].querySelector('.stat-value');
    diskBar.style.width = `${stats.disk.usage}%`;
    diskBar.style.backgroundColor = getColorForUsage(stats.disk.usage);
    diskValue.textContent = `${stats.disk.usage}% (${stats.disk.used}/${stats.disk.total})`;
}

// 根据使用率获取颜色
function getColorForUsage(usage) {
    if (usage < 60) return '#4CAF50'; // 绿色
    if (usage < 80) return '#FF9800'; // 橙色
    return '#f44336'; // 红色
}

// 显示监控图表
async function showMonitorChart(serverId, serverName) {
    const modal = document.getElementById('monitor-chart-modal');
    const serverNameEl = document.getElementById('monitor-server-name');

    serverNameEl.textContent = serverName;
    modal.style.display = 'flex';

    // 保存当前服务器 ID
    state.currentMonitorServerId = serverId;

    // 加载历史数据并绘制图表
    await loadAndDrawCharts(serverId);
}

// 加载并绘制图表
async function loadAndDrawCharts(serverId, duration = '1h') {
    try {
        const response = await apiCall(`/monitor/${serverId}/history?duration=${duration}`);

        if (response.success && response.history) {
            drawChart('cpu-chart', response.history, 'CPU 使用率', 'cpu');
            drawChart('memory-chart', response.history, '内存使用率', 'memory');
            drawChart('disk-chart', response.history, '磁盘使用率', 'disk');
        }
    } catch (error) {
        console.error('加载历史数据失败:', error);
    }
}

// 绘制图表
function drawChart(canvasId, data, title, dataKey) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    // 绘制背景
    ctx.fillStyle = '#f9f9f9';
    ctx.fillRect(0, 0, width, height);

    // 绘制标题
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 20);

    // 获取数据
    const values = data[dataKey];
    if (!values || values.length === 0) return;

    const maxValue = 100; // 百分比最大值
    const minValue = 0;

    // 绘制网格线和 Y 轴标签
    ctx.strokeStyle = '#ddd';
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 5; i++) {
        const y = padding + (chartHeight / 5) * i;
        const value = maxValue - (maxValue / 5) * i;

        // 网格线
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();

        // Y 轴标签
        ctx.fillText(value.toFixed(0) + '%', padding - 5, y + 3);
    }

    // 绘制 X 轴网格线
    const step = Math.floor(values.length / 5);
    for (let i = 0; i < values.length; i += step) {
        const x = padding + (chartWidth / (values.length - 1)) * i;

        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - padding);
        ctx.stroke();
    }

    // 绘制数据线
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 2;
    ctx.beginPath();

    values.forEach((value, index) => {
        const x = padding + (chartWidth / (values.length - 1)) * index;
        const y = padding + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.stroke();

    // 绘制数据点
    ctx.fillStyle = '#2196F3';
    values.forEach((value, index) => {
        const x = padding + (chartWidth / (values.length - 1)) * index;
        const y = padding + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
    });

    // 绘制坐标轴
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;

    // Y 轴
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.stroke();

    // X 轴
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // X 轴时间标签
    ctx.fillStyle = '#666';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';

    for (let i = 0; i < values.length; i += step) {
        const x = padding + (chartWidth / (values.length - 1)) * i;
        const timestamp = new Date(data.timestamps[i]);
        const timeStr = timestamp.getHours().toString().padStart(2, '0') + ':' +
                       timestamp.getMinutes().toString().padStart(2, '0');
        ctx.fillText(timeStr, x, height - padding + 15);
    }
}

// 关闭监控图表
function closeMonitorChart() {
    document.getElementById('monitor-chart-modal').style.display = 'none';
}

// 切换监控时间范围
function changeMonitorDuration(duration) {
    // 更新按钮状态
    document.querySelectorAll('.duration-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // 重新加载数据
    if (state.currentMonitorServerId) {
        loadAndDrawCharts(state.currentMonitorServerId, duration);
    }
}

// ==================== 高级编辑器 ====================

// 为 textarea 添加高级编辑功能
function enhanceTextarea(textarea, options = {}) {
    const {
        format = 'toml', // toml, json, text
        showLineNumbers = false,
        enableFormat = true,
        enableValidation = true
    } = options;

    // 创建包装容器
    const wrapper = document.createElement('div');
    wrapper.className = 'enhanced-editor';
    textarea.parentNode.insertBefore(wrapper, textarea);
    wrapper.appendChild(textarea);

    // 添加工具栏
    if (enableFormat || enableValidation) {
        const toolbar = document.createElement('div');
        toolbar.className = 'editor-toolbar';

        if (enableFormat) {
            const formatBtn = document.createElement('button');
            formatBtn.type = 'button';
            formatBtn.className = 'btn btn-sm btn-secondary';
            formatBtn.innerHTML = '✨ 格式化';
            formatBtn.onclick = () => formatTextarea(textarea, format);
            toolbar.appendChild(formatBtn);
        }

        if (enableValidation) {
            const validateBtn = document.createElement('button');
            validateBtn.type = 'button';
            validateBtn.className = 'btn btn-sm btn-secondary';
            validateBtn.innerHTML = '✓ 验证';
            validateBtn.onclick = () => validateTextarea(textarea, format);
            toolbar.appendChild(validateBtn);
        }

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'btn btn-sm btn-secondary';
        clearBtn.innerHTML = '🗑️ 清空';
        clearBtn.onclick = () => {
            if (confirm('确定要清空内容吗？')) {
                textarea.value = '';
            }
        };
        toolbar.appendChild(clearBtn);

        wrapper.insertBefore(toolbar, textarea);
    }

    // 添加编辑器样式
    textarea.classList.add('code-editor');
}

// 格式化 textarea 内容
function formatTextarea(textarea, format) {
    const content = textarea.value.trim();
    if (!content) {
        alert('内容为空，无需格式化');
        return;
    }

    try {
        let formatted;

        if (format === 'json') {
            // JSON 格式化
            const obj = JSON.parse(content);
            formatted = JSON.stringify(obj, null, 2);
        } else if (format === 'toml') {
            // TOML 基本格式化（简单处理）
            formatted = formatToml(content);
        } else {
            // 文本格式：去除多余空行
            formatted = content.split('\n')
                .map(line => line.trimEnd())
                .join('\n')
                .replace(/\n{3,}/g, '\n\n');
        }

        textarea.value = formatted;
        addApiLog(`${format.toUpperCase()} 格式化成功`, 'success');

        // 闪烁效果
        textarea.style.backgroundColor = '#d4edda';
        setTimeout(() => {
            textarea.style.backgroundColor = '';
        }, 300);
    } catch (error) {
        alert(`格式化失败: ${error.message}`);
        addApiLog(`格式化失败: ${error.message}`, 'error');
    }
}

// 简单的 TOML 格式化
function formatToml(content) {
    const lines = content.split('\n');
    const formatted = [];
    let prevLineEmpty = false;

    for (let line of lines) {
        const trimmed = line.trim();

        // 跳过连续的空行
        if (trimmed === '') {
            if (!prevLineEmpty) {
                formatted.push('');
                prevLineEmpty = true;
            }
            continue;
        }

        prevLineEmpty = false;

        // 处理注释
        if (trimmed.startsWith('#')) {
            formatted.push(trimmed);
            continue;
        }

        // 处理节（section）
        if (trimmed.startsWith('[')) {
            if (formatted.length > 0 && formatted[formatted.length - 1] !== '') {
                formatted.push('');
            }
            formatted.push(trimmed);
            continue;
        }

        // 处理键值对
        if (trimmed.includes('=')) {
            const [key, ...valueParts] = trimmed.split('=');
            const value = valueParts.join('=').trim();
            formatted.push(`${key.trim()} = ${value}`);
            continue;
        }

        // 其他行保持原样
        formatted.push(trimmed);
    }

    return formatted.join('\n');
}

// 验证 textarea 内容
function validateTextarea(textarea, format) {
    const content = textarea.value.trim();

    if (!content) {
        alert('内容为空');
        return;
    }

    try {
        if (format === 'json') {
            JSON.parse(content);
            alert('✓ JSON 格式正确');
            addApiLog('JSON 验证通过', 'success');
        } else if (format === 'toml') {
            // TOML 基本验证
            const valid = validateToml(content);
            if (valid) {
                alert('✓ TOML 格式看起来正确');
                addApiLog('TOML 验证通过', 'success');
            }
        } else {
            alert('✓ 内容不为空');
        }

        textarea.style.borderColor = '#28a745';
        setTimeout(() => {
            textarea.style.borderColor = '';
        }, 1000);
    } catch (error) {
        alert(`✗ 格式错误:\n${error.message}`);
        addApiLog(`验证失败: ${error.message}`, 'error');
        textarea.style.borderColor = '#dc3545';
    }
}

// 简单的 TOML 验证
function validateToml(content) {
    const lines = content.split('\n');
    let inSection = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line === '' || line.startsWith('#')) {
            continue;
        }

        // 检查节
        if (line.startsWith('[')) {
            if (!line.endsWith(']')) {
                throw new Error(`第 ${i + 1} 行: 节定义不完整 - ${line}`);
            }
            inSection = true;
            continue;
        }

        // 检查键值对
        if (line.includes('=')) {
            const parts = line.split('=');
            if (parts.length < 2) {
                throw new Error(`第 ${i + 1} 行: 键值对格式错误 - ${line}`);
            }
            const key = parts[0].trim();
            if (!key) {
                throw new Error(`第 ${i + 1} 行: 键名为空 - ${line}`);
            }
            continue;
        }

        // 其他格式可能有问题，但不严格报错
        console.warn(`第 ${i + 1} 行: 可能的格式问题 - ${line}`);
    }

    return true;
}

// 初始化所有增强编辑器
function initEnhancedEditors() {
    // 创建实例表单中的路由配置
    const createInstanceRouteConfig = document.querySelector('#create-instance-form textarea[name="routeConfig"]');
    if (createInstanceRouteConfig) {
        enhanceTextarea(createInstanceRouteConfig, { format: 'toml', enableFormat: true, enableValidation: true });
    }

    const createInstanceBlockList = document.querySelector('#create-instance-form textarea[name="blockList"]');
    if (createInstanceBlockList) {
        enhanceTextarea(createInstanceBlockList, { format: 'text', enableFormat: true, enableValidation: false });
    }

    // 路由配置模板表单
    const routeConfigForm = document.querySelector('#add-route-config-form textarea[name="routeConfig"]');
    if (routeConfigForm) {
        enhanceTextarea(routeConfigForm, { format: 'toml', enableFormat: true, enableValidation: true });
    }

    const routeConfigBlockList = document.querySelector('#add-route-config-form textarea[name="blockList"]');
    if (routeConfigBlockList) {
        enhanceTextarea(routeConfigBlockList, { format: 'text', enableFormat: true, enableValidation: false });
    }

    addApiLog('高级编辑器初始化完成', 'info');
}

// ==================== 模板管理 ====================

// 添加模板列表到状态
state.templates = [];

// 加载模板列表
async function loadTemplates() {
    try {
        const response = await apiCall('/templates', {}, false);
        if (response.success) {
            state.templates = response.templates || [];
            renderTemplates();
            updateTemplateSelector();
        }
    } catch (error) {
        console.error('加载模板列表失败:', error);
        state.templates = [];
    }
}

// 渲染模板列表
function renderTemplates() {
    const templatesList = document.getElementById('templates-list');
    if (!templatesList) return;

    if (state.templates.length === 0) {
        templatesList.innerHTML = `
            <div class="empty-state">
                <h3>📋 还没有保存的模板</h3>
                <p>点击"新建模板"按钮来创建配置模板</p>
                <p style="margin-top: 10px; color: #666; font-size: 0.9em;">
                    模板可以保存常用的面板类型、mukey、对接域名等配置信息，<br>
                    方便快速创建新实例
                </p>
            </div>
        `;
        return;
    }

    templatesList.innerHTML = state.templates.map(template => `
        <div class="card" style="margin-bottom: 15px;">
            <div class="card-header">
                <div class="card-title">${template.name}</div>
                <div class="card-actions">
                    <button class="btn btn-sm btn-primary" onclick="loadTemplateToForm('${template.id}', true)">📝 使用模板</button>
                    <button class="btn btn-sm btn-secondary" onclick="editTemplate('${template.id}')">✏️ 编辑</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteTemplate('${template.id}')">🗑️ 删除</button>
                </div>
            </div>
            <div class="card-body">
                <div class="card-info">
                    ${template.description ? `
                    <div class="card-info-item">
                        <span class="card-info-label">描述:</span>
                        <span class="card-info-value">${template.description}</span>
                    </div>
                    ` : ''}
                    <div class="card-info-item">
                        <span class="card-info-label">面板类型:</span>
                        <span class="card-info-value">${template.config.panelType}</span>
                    </div>
                    <div class="card-info-item">
                        <span class="card-info-label">后端类型:</span>
                        <span class="card-info-value">${template.config.serverType || '未设置'}</span>
                    </div>
                    <div class="card-info-item">
                        <span class="card-info-label">对接方式:</span>
                        <span class="card-info-value">${template.config.api}</span>
                    </div>
                    ${template.config.api === 'webapi' && template.config.panelUrl ? `
                    <div class="card-info-item">
                        <span class="card-info-label">面板 URL:</span>
                        <span class="card-info-value">${template.config.panelUrl}</span>
                    </div>
                    ` : ''}
                    <div class="card-info-item">
                        <span class="card-info-label">创建时间:</span>
                        <span class="card-info-value">${formatDate(template.createdAt)}</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// 更新创建实例表单中的模板选择器
function updateTemplateSelector() {
    const select = document.getElementById('load-template-select');
    if (!select) return;

    select.innerHTML = '<option value="">手动配置</option>' +
        state.templates.map(template =>
            `<option value="${template.id}">${template.name}</option>`
        ).join('');
}

// 从模板加载配置到表单
function loadTemplateToForm(templateId, closeTemplateManager = false) {
    const template = state.templates.find(t => t.id === templateId);
    if (!template) {
        alert('模板不存在');
        return;
    }

    // 关闭模板管理器
    if (closeTemplateManager) {
        document.getElementById('template-manager-modal').style.display = 'none';
    }

    // 打开创建实例模态框
    if (state.servers.length === 0) {
        alert('请先添加服务器');
        return;
    }
    loadServerSelect();
    elements.createInstanceModal.style.display = 'block';

    // 填充表单
    const form = elements.createInstanceForm;
    const config = template.config;

    // 基础配置
    if (config.panelType) form.querySelector('[name="panelType"]').value = config.panelType;
    if (config.serverType) form.querySelector('[name="serverType"]').value = config.serverType;
    if (config.sogaKey) form.querySelector('[name="sogaKey"]').value = config.sogaKey;
    if (config.panelUrl) form.querySelector('[name="panelUrl"]').value = config.panelUrl;
    if (config.panelKey) form.querySelector('[name="panelKey"]').value = config.panelKey;

    // 数据库配置
    if (config.dbHost) form.querySelector('[name="dbHost"]').value = config.dbHost;
    if (config.dbPort) form.querySelector('[name="dbPort"]').value = config.dbPort;
    if (config.dbName) form.querySelector('[name="dbName"]').value = config.dbName;
    if (config.dbUser) form.querySelector('[name="dbUser"]').value = config.dbUser;
    if (config.dbPassword) form.querySelector('[name="dbPassword"]').value = config.dbPassword;

    // 日志配置
    if (config.logLevel) form.querySelector('[name="logLevel"]').value = config.logLevel;
    if (config.logFile) form.querySelector('[name="logFile"]').value = config.logFile;

    // 检查间隔和限制
    if (config.checkInterval) form.querySelector('[name="checkInterval"]').value = config.checkInterval;
    if (config.userConnLimit) form.querySelector('[name="userConnLimit"]').value = config.userConnLimit;
    if (config.userSpeedLimit) form.querySelector('[name="userSpeedLimit"]').value = config.userSpeedLimit;

    // DNS 配置
    if (config.enableDNS !== undefined) {
        const dnsCheckbox = form.querySelector('[name="enableDNS"]');
        if (dnsCheckbox) dnsCheckbox.checked = config.enableDNS;
    }
    if (config.defaultDns) form.querySelector('[name="defaultDns"]').value = config.defaultDns;
    if (config.dnsCacheTime) form.querySelector('[name="dnsCacheTime"]').value = config.dnsCacheTime;
    if (config.dnsStrategy) form.querySelector('[name="dnsStrategy"]').value = config.dnsStrategy;
    if (config.dnsType) form.querySelector('[name="dnsType"]').value = config.dnsType;
    if (config.dnsListenPort) form.querySelector('[name="dnsListenPort"]').value = config.dnsListenPort;

    // 路由配置
    if (config.routeConfig) form.querySelector('[name="routeConfig"]').value = config.routeConfig;
    if (config.blockList) form.querySelector('[name="blockList"]').value = config.blockList;

    // 其他配置
    if (config.enableProxyProtocol !== undefined) {
        const proxyCheckbox = form.querySelector('[name="enableProxyProtocol"]');
        if (proxyCheckbox) proxyCheckbox.checked = config.enableProxyProtocol;
    }

    addApiLog(`已加载模板: ${template.name}`, 'info');
    alert(`已加载模板: ${template.name}\n请继续填写实例名称和节点 ID`);
}

// 编辑模板
function editTemplate(templateId) {
    const template = state.templates.find(t => t.id === templateId);
    if (!template) {
        alert('模板不存在');
        return;
    }

    // 打开编辑模态框
    const modal = document.getElementById('edit-template-modal');
    const form = document.getElementById('edit-template-form');

    // 保存模板 ID
    form.dataset.templateId = templateId;

    // 填充表单
    form.querySelector('[name="name"]').value = template.name;
    form.querySelector('[name="description"]').value = template.description || '';

    const config = template.config;
    if (config.panelType) form.querySelector('[name="panelType"]').value = config.panelType;
    if (config.serverType) form.querySelector('[name="serverType"]').value = config.serverType;
    if (config.sogaKey) form.querySelector('[name="sogaKey"]').value = config.sogaKey;
    if (config.panelUrl) form.querySelector('[name="panelUrl"]').value = config.panelUrl;
    if (config.panelKey) form.querySelector('[name="panelKey"]').value = config.panelKey;

    modal.style.display = 'block';
}

// 删除模板
async function deleteTemplate(templateId) {
    const template = state.templates.find(t => t.id === templateId);
    if (!template) {
        alert('模板不存在');
        return;
    }

    if (!confirm(`确定要删除模板"${template.name}"吗？`)) {
        return;
    }

    try {
        await apiCall(`/templates/${templateId}`, {
            method: 'DELETE'
        });
        alert('模板删除成功');
        loadTemplates();
    } catch (error) {
        console.error('删除模板失败:', error);
    }
}

// 初始化模板管理
function initTemplateManagement() {
    // 加载模板列表
    loadTemplates();

    // 模板管理器按钮
    const templateManagerBtn = document.getElementById('template-manager-btn');
    if (templateManagerBtn) {
        templateManagerBtn.addEventListener('click', () => {
            document.getElementById('template-manager-modal').style.display = 'block';
            loadTemplates();
        });
    }

    // 新建模板按钮
    const addTemplateBtn = document.getElementById('add-template-btn');
    if (addTemplateBtn) {
        addTemplateBtn.addEventListener('click', () => {
            document.getElementById('template-manager-modal').style.display = 'none';
            document.getElementById('edit-template-modal').style.display = 'block';
            document.getElementById('edit-template-form').reset();
            delete document.getElementById('edit-template-form').dataset.templateId;
        });
    }

    // 编辑模板表单提交
    const editTemplateForm = document.getElementById('edit-template-form');
    if (editTemplateForm) {
        editTemplateForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(e.target);
            const templateId = e.target.dataset.templateId;

            const templateData = {
                name: formData.get('name'),
                description: formData.get('description') || '',
                config: {
                    panelType: formData.get('panelType'),
                    serverType: formData.get('serverType'),
                    sogaKey: formData.get('sogaKey'),
                    panelUrl: formData.get('panelUrl'),
                    panelKey: formData.get('panelKey')
                }
            };

            try {
                if (templateId) {
                    // 更新模板
                    await apiCall(`/templates/${templateId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(templateData)
                    });
                    alert('模板更新成功');
                } else {
                    // 创建模板
                    await apiCall('/templates', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(templateData)
                    });
                    alert('模板创建成功');
                }

                document.getElementById('edit-template-modal').style.display = 'none';
                loadTemplates();
            } catch (error) {
                console.error('保存模板失败:', error);
            }
        });
    }

    // 模板选择器变化事件
    const loadTemplateSelect = document.getElementById('load-template-select');
    if (loadTemplateSelect) {
        loadTemplateSelect.addEventListener('change', (e) => {
            const templateId = e.target.value;
            if (templateId) {
                loadTemplateToForm(templateId, false);
            }
        });
    }

    // 仅保存模板按钮（不创建实例）
    const saveTemplateOnlyBtn = document.getElementById('save-template-only-btn');
    if (saveTemplateOnlyBtn) {
        saveTemplateOnlyBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            const templateName = prompt('请输入模板名称:');
            if (!templateName) return;

            const form = elements.createInstanceForm;
            const formData = new FormData(form);

            const templateData = {
                name: templateName,
                description: formData.get('instanceName') ?
                    `基于实例配置 ${formData.get('instanceName')} 创建` :
                    '手动创建的配置模板',
                config: {
                    panelType: formData.get('panelType'),
                    serverType: formData.get('serverType'),
                    sogaKey: formData.get('sogaKey'),
                    panelUrl: formData.get('panelUrl'),
                    panelKey: formData.get('panelKey'),
                    dbHost: formData.get('dbHost'),
                    dbPort: formData.get('dbPort'),
                    dbName: formData.get('dbName'),
                    dbUser: formData.get('dbUser'),
                    dbPassword: formData.get('dbPassword'),
                    logLevel: formData.get('logLevel'),
                    logFile: formData.get('logFile'),
                    checkInterval: formData.get('checkInterval'),
                    userConnLimit: formData.get('userConnLimit'),
                    userSpeedLimit: formData.get('userSpeedLimit'),
                    enableDNS: formData.get('enableDNS') === 'on',
                    defaultDns: formData.get('defaultDns'),
                    dnsCacheTime: formData.get('dnsCacheTime'),
                    dnsStrategy: formData.get('dnsStrategy'),
                    dnsType: formData.get('dnsType'),
                    dnsListenPort: formData.get('dnsListenPort'),
                    routeConfig: formData.get('routeConfig'),
                    blockList: formData.get('blockList'),
                    enableProxyProtocol: formData.get('enableProxyProtocol') === 'on'
                }
            };

            try {
                await apiCall('/templates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(templateData)
                });

                addApiLog(`模板 ${templateName} 保存成功`, 'success');
                alert(`✓ 模板"${templateName}"保存成功！\n\n您可以在"模板管理"中查看和使用此模板。`);

                // 刷新模板列表
                loadTemplates();
            } catch (error) {
                console.error('保存模板失败:', error);
                addApiLog(`保存模板失败: ${error.message}`, 'error');
            }
        });
    }

    // 保存模板并创建实例按钮
    const saveTemplateAndCreateBtn = document.getElementById('save-template-and-create-btn');
    if (saveTemplateAndCreateBtn) {
        saveTemplateAndCreateBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            const templateName = prompt('请输入模板名称:');
            if (!templateName) return;

            const form = elements.createInstanceForm;
            const formData = new FormData(form);

            const templateData = {
                name: templateName,
                description: `基于实例 ${formData.get('instanceName') || '未命名'} 创建`,
                config: {
                    panelType: formData.get('panelType'),
                    serverType: formData.get('serverType'),
                    sogaKey: formData.get('sogaKey'),
                    panelUrl: formData.get('panelUrl'),
                    panelKey: formData.get('panelKey'),
                    dbHost: formData.get('dbHost'),
                    dbPort: formData.get('dbPort'),
                    dbName: formData.get('dbName'),
                    dbUser: formData.get('dbUser'),
                    dbPassword: formData.get('dbPassword'),
                    logLevel: formData.get('logLevel'),
                    logFile: formData.get('logFile'),
                    checkInterval: formData.get('checkInterval'),
                    userConnLimit: formData.get('userConnLimit'),
                    userSpeedLimit: formData.get('userSpeedLimit'),
                    enableDNS: formData.get('enableDNS') === 'on',
                    defaultDns: formData.get('defaultDns'),
                    dnsCacheTime: formData.get('dnsCacheTime'),
                    dnsStrategy: formData.get('dnsStrategy'),
                    dnsType: formData.get('dnsType'),
                    dnsListenPort: formData.get('dnsListenPort'),
                    routeConfig: formData.get('routeConfig'),
                    blockList: formData.get('blockList'),
                    enableProxyProtocol: formData.get('enableProxyProtocol') === 'on'
                }
            };

            try {
                await apiCall('/templates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(templateData)
                });

                addApiLog(`模板 ${templateName} 保存成功`, 'success');
                alert(`✓ 模板"${templateName}"保存成功！\n即将创建实例...`);

                // 刷新模板列表
                loadTemplates();

                // 继续提交创建实例表单
                form.requestSubmit();
            } catch (error) {
                console.error('保存模板失败:', error);
                addApiLog(`保存模板失败: ${error.message}`, 'error');
            }
        });
    }
}
