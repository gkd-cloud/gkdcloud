const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const AUTH_FILE = path.join(__dirname, '../../data/auth.json');

class AuthService {
  // 初始化认证文件
  static async init() {
    try {
      await fs.access(AUTH_FILE);
    } catch {
      // 默认管理员账号：admin / admin123
      const defaultAuth = {
        username: 'admin',
        password: this.hashPassword('admin123'),
        createdAt: new Date().toISOString()
      };
      await fs.writeFile(AUTH_FILE, JSON.stringify(defaultAuth, null, 2));
      console.log('已创建默认管理员账号：admin / admin123');
      console.log('！！！请立即修改默认密码！！！');
    }
  }

  // 密码加密
  static hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  // 验证登录
  static async verifyLogin(username, password) {
    try {
      const data = await fs.readFile(AUTH_FILE, 'utf8');
      const auth = JSON.parse(data);
      
      const hashedPassword = this.hashPassword(password);
      
      if (auth.username === username && auth.password === hashedPassword) {
        // 生成 token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时
        
        // 保存 token
        auth.token = token;
        auth.tokenExpiresAt = expiresAt.toISOString();
        auth.lastLogin = new Date().toISOString();
        
        await fs.writeFile(AUTH_FILE, JSON.stringify(auth, null, 2));
        
        return { success: true, token, expiresAt };
      } else {
        return { success: false, message: '用户名或密码错误' };
      }
    } catch (error) {
      return { success: false, message: '认证失败' };
    }
  }

  // 验证 token
  static async verifyToken(token) {
    try {
      const data = await fs.readFile(AUTH_FILE, 'utf8');
      const auth = JSON.parse(data);
      
      if (auth.token === token) {
        const expiresAt = new Date(auth.tokenExpiresAt);
        if (expiresAt > new Date()) {
          return { valid: true };
        } else {
          return { valid: false, message: 'Token 已过期，请重新登录' };
        }
      } else {
        return { valid: false, message: 'Token 无效' };
      }
    } catch (error) {
      return { valid: false, message: '认证失败' };
    }
  }

  // 修改密码
  static async changePassword(oldPassword, newPassword) {
    try {
      const data = await fs.readFile(AUTH_FILE, 'utf8');
      const auth = JSON.parse(data);
      
      const hashedOldPassword = this.hashPassword(oldPassword);
      
      if (auth.password === hashedOldPassword) {
        auth.password = this.hashPassword(newPassword);
        auth.passwordChangedAt = new Date().toISOString();
        // 清除 token，强制重新登录
        delete auth.token;
        delete auth.tokenExpiresAt;
        
        await fs.writeFile(AUTH_FILE, JSON.stringify(auth, null, 2));
        return { success: true, message: '密码修改成功，请重新登录' };
      } else {
        return { success: false, message: '原密码错误' };
      }
    } catch (error) {
      return { success: false, message: '密码修改失败' };
    }
  }

  // 登出
  static async logout(token) {
    try {
      const data = await fs.readFile(AUTH_FILE, 'utf8');
      const auth = JSON.parse(data);
      
      if (auth.token === token) {
        delete auth.token;
        delete auth.tokenExpiresAt;
        await fs.writeFile(AUTH_FILE, JSON.stringify(auth, null, 2));
      }
      
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  }
}

// 认证中间件
const authMiddleware = async (req, res, next) => {
  // 登录接口不需要认证
  if (req.path === '/api/auth/login') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader ? authHeader.replace('Bearer ', '') : null;
  
  if (!token) {
    return res.status(401).json({ error: '未登录', requiresAuth: true });
  }

  const result = await AuthService.verifyToken(token);
  
  if (result.valid) {
    next();
  } else {
    res.status(401).json({ error: result.message, requiresAuth: true });
  }
};

module.exports = { AuthService, authMiddleware };