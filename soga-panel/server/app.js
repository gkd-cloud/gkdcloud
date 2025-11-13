const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const { AuthService, authMiddleware } = require('./services/auth');
const authRoutes = require('./routes/auth');
const serverRoutes = require('./routes/server');
const sogaRoutes = require('./routes/soga');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json({ limit: '100mb' })); // 增加限制以支持文件上传
app.use(bodyParser.urlencoded({ extended: true, limit: '100mb' }));

// 增加请求超时时间（5分钟）
app.use((req, res, next) => {
  req.setTimeout(300000); // 5 分钟
  res.setTimeout(300000);
  next();
});

// 静态文件
app.use(express.static(path.join(__dirname, '../public')));

// 确保数据目录存在
const initDataDir = async () => {
  const dataDir = path.join(__dirname, '../data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
    // 初始化 servers.json
    await fs.writeFile(
      path.join(dataDir, 'servers.json'),
      JSON.stringify({ servers: [], instances: [] }, null, 2)
    );
  }
  
  // 初始化认证
  await AuthService.init();
};

// 认证路由（不需要认证中间件）
app.use('/api/auth', authRoutes);

// API 路由（需要认证）
app.use('/api/servers', authMiddleware, serverRoutes);
app.use('/api/soga', authMiddleware, sogaRoutes);

// 健康检查（不需要认证）
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: err.message 
  });
});

// 启动服务器
const startServer = async () => {
  await initDataDir();
  app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`Soga Panel 已启动`);
    console.log(`访问地址: http://localhost:${PORT}`);
    console.log(`API 地址: http://localhost:${PORT}/api`);
    console.log(`=================================`);
    console.log(`默认账号: admin`);
    console.log(`默认密码: admin123`);
    console.log(`！！！请立即登录并修改密码！！！`);
    console.log(`=================================`);
  });
};

startServer().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
