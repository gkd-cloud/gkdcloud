const express = require('express');
const router = express.Router();
const { SSHConnection } = require('../services/ssh');
const fs = require('fs').promises;
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data/servers.json');

// 读取数据
const readData = async () => {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
};

// 获取服务器监控数据
router.get('/:serverId/stats', async (req, res) => {
    try {
        const { serverId } = req.params;
        const data = await readData();
        const server = data.servers.find(s => s.id === serverId);

        if (!server) {
            return res.status(404).json({ success: false, error: '服务器不存在' });
        }

        const ssh = new SSHConnection(server);
        await ssh.connect();

        try {
            // 获取 CPU 使用率
            const cpuCommand = `top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk '{print 100 - $1}'`;
            const cpuResult = await ssh.exec(cpuCommand);
            const cpuUsage = parseFloat(cpuResult.trim()) || 0;

            // 获取内存使用率
            const memCommand = `free | grep Mem | awk '{printf "%.2f\\n%.2f\\n%.2f", $3/$2 * 100.0, $3/1024/1024, $2/1024/1024}'`;
            const memResult = await ssh.exec(memCommand);
            const memLines = memResult.trim().split('\n');
            const memUsage = parseFloat(memLines[0]) || 0;
            const memUsed = parseFloat(memLines[1]) || 0;
            const memTotal = parseFloat(memLines[2]) || 0;

            // 获取磁盘使用率
            const diskCommand = `df -h / | tail -1 | awk '{print $5, $3, $2}' | sed 's/%//'`;
            const diskResult = await ssh.exec(diskCommand);
            const diskParts = diskResult.trim().split(' ');
            const diskUsage = parseFloat(diskParts[0]) || 0;
            const diskUsed = diskParts[1] || '0';
            const diskTotal = diskParts[2] || '0';

            // 获取系统负载
            const loadCommand = `uptime | awk -F'load average:' '{print $2}' | awk '{print $1, $2, $3}' | sed 's/,//g'`;
            const loadResult = await ssh.exec(loadCommand);
            const loadParts = loadResult.trim().split(' ');
            const load1 = parseFloat(loadParts[0]) || 0;
            const load5 = parseFloat(loadParts[1]) || 0;
            const load15 = parseFloat(loadParts[2]) || 0;

            // 获取运行时间
            const uptimeCommand = `uptime -p | sed 's/up //'`;
            const uptimeResult = await ssh.exec(uptimeCommand);
            const uptime = uptimeResult.trim();

            await ssh.close();

            res.json({
                success: true,
                stats: {
                    cpu: {
                        usage: Math.round(cpuUsage * 10) / 10
                    },
                    memory: {
                        usage: Math.round(memUsage * 10) / 10,
                        used: Math.round(memUsed * 100) / 100,
                        total: Math.round(memTotal * 100) / 100
                    },
                    disk: {
                        usage: Math.round(diskUsage * 10) / 10,
                        used: diskUsed,
                        total: diskTotal
                    },
                    load: {
                        load1: Math.round(load1 * 100) / 100,
                        load5: Math.round(load5 * 100) / 100,
                        load15: Math.round(load15 * 100) / 100
                    },
                    uptime
                }
            });
        } catch (error) {
            await ssh.close();
            throw error;
        }
    } catch (error) {
        console.error('获取服务器监控数据失败:', error);
        res.status(500).json({
            success: false,
            error: error.message || '获取监控数据失败'
        });
    }
});

// 获取服务器历史监控数据（用于图表）
router.get('/:serverId/history', async (req, res) => {
    try {
        const { serverId } = req.params;
        const { duration = '1h' } = req.query; // 1h, 6h, 24h, 7d

        // 这里简化实现，实际应该从数据库或缓存中获取历史数据
        // 现在先返回模拟数据，后续可以实现真实的历史数据收集

        const data = await readData();
        const server = data.servers.find(s => s.id === serverId);

        if (!server) {
            return res.status(404).json({ success: false, error: '服务器不存在' });
        }

        // 生成时间点
        const points = 20;
        const now = Date.now();
        const interval = duration === '1h' ? 3 * 60 * 1000 :
                        duration === '6h' ? 18 * 60 * 1000 :
                        duration === '24h' ? 72 * 60 * 1000 :
                        504 * 60 * 1000; // 7d

        const history = {
            timestamps: [],
            cpu: [],
            memory: [],
            disk: []
        };

        for (let i = points - 1; i >= 0; i--) {
            const timestamp = now - (i * interval);
            history.timestamps.push(new Date(timestamp).toISOString());

            // 生成随机监控数据（实际应从数据库获取）
            history.cpu.push(Math.random() * 30 + 20); // 20-50%
            history.memory.push(Math.random() * 20 + 40); // 40-60%
            history.disk.push(Math.random() * 10 + 50); // 50-60%
        }

        res.json({
            success: true,
            history,
            duration
        });
    } catch (error) {
        console.error('获取历史监控数据失败:', error);
        res.status(500).json({
            success: false,
            error: error.message || '获取历史数据失败'
        });
    }
});

module.exports = router;
