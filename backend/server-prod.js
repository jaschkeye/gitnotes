const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

// 【修复 CORS 问题】允许前端公网域名访问
app.use(cors({ origin: true }));

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'gitnotes-secret-key-2025';

// 【数据库连接】使用 Railway 自动注入的环境变量
// Railway MySQL 私有网络地址
const RAILWAY_MYSQL_HOST = 'mysql.railway.internal';
const dbConfig = {
    host: process.env.DB_HOST || RAILWAY_MYSQL_HOST,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'railway',
    port: parseInt(process.env.DB_PORT) || 3306
};

// 打印实际 DB 配置用于调试
console.log('DB Config:', {
    host: dbConfig.host,
    user: dbConfig.user ? '***' : 'MISSING',
    database: dbConfig.database,
    port: dbConfig.port
});

let pool;
async function initDB() {
    try {
        pool = await mysql.createPool(dbConfig);
        // 初始化表结构（如果不存在）
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL
            )
        `);
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS snippets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                title VARCHAR(255),
                content TEXT,
                language VARCHAR(50),
                tags JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('MySQL Database Connected');
    } catch (error) {
        console.error('Failed to initialize database:', error.message);
        console.error('DB Config:', {
            host: dbConfig.host ? 'SET' : 'MISSING',
            user: dbConfig.user ? 'SET' : 'MISSING',
            database: dbConfig.database ? 'SET' : 'MISSING',
            port: dbConfig.port
        });
        throw error;
    }
}

// --- 用户认证模块 ---

app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        await pool.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
        res.json({ message: '注册成功' });
    } catch (err) {
        res.status(400).json({ error: '用户名已存在' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0 || !(await bcrypt.compare(password, rows[0].password))) {
        return res.status(401).json({ error: '用户名或密码错误' });
    }
    const token = jwt.sign({ id: rows[0].id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username });
});

// --- AI 标签推荐（带重试机制）---

app.post('/api/ai/tags', async (req, res) => {
    const { content } = req.body;
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
        try {
            const response = await axios.post(
                'https://api.moonshot.cn/v1/chat/completions',
                {
                    model: "moonshot-v1-8k",
                    messages: [
                        { role: "system", content: "你是一个编程助手，请根据代码内容返回3-5个技术标签，以逗号分隔，不要有其他解释。" },
                        { role: "user", content: content }
                    ],
                    temperature: 0.3
                },
                {
                    headers: { 'Authorization': `Bearer ${process.env.AI_API_KEY}` },
                    timeout: 30000 // 增加超时到30秒
                }
            );
            return res.json({ tags: response.data.choices[0].message.content.split(',') });
        } catch (error) {
            attempt++;
            if (error.response?.status === 429 && attempt < MAX_RETRIES) {
                console.warn(`Kimi API 429 频率限制，正在进行第 ${attempt} 次重试...`);
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // 指数退避
                continue;
            }
            // 最终失败触发本地降级逻辑
            return res.json({ tags: ['Local', 'Draft'], note: 'AI 过载，已使用本地兜底标签' });
        }
    }
});

// --- 代码片段管理 ---

app.get('/api/snippets', async (req, res) => {
    // 此处应添加 JWT 校验中间件，简化起见直接查询
    const [rows] = await pool.execute('SELECT * FROM snippets ORDER BY created_at DESC');
    res.json(rows);
});

app.post('/api/snippets', async (req, res) => {
    const { title, content, language, tags } = req.body;
    await pool.execute(
        'INSERT INTO snippets (title, content, language, tags) VALUES (?, ?, ?, ?)',
        [title, content, language, JSON.stringify(tags)]
    );
    res.json({ message: '保存成功' });
});

// 启动服务
initDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
    });
});
