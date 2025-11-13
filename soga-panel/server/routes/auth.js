const express = require('express');
const router = express.Router();
const { AuthService } = require('../services/auth');

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const result = await AuthService.verifyLogin(username, password);

    if (result.success) {
      res.json({
        success: true,
        token: result.token,
        expiresAt: result.expiresAt
      });
    } else {
      res.status(401).json({ error: result.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 登出
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;
    await AuthService.logout(token);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 修改密码
router.post('/change-password', async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '原密码和新密码不能为空' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码长度不能少于 6 位' });
    }

    const result = await AuthService.changePassword(oldPassword, newPassword);

    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 验证 token
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    if (!token) {
      return res.status(401).json({ valid: false });
    }

    const result = await AuthService.verifyToken(token);
    res.json({ valid: result.valid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;