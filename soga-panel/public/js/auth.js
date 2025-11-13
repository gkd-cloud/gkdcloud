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
