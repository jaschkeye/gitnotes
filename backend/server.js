const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'gitnotes-secret-key';

// 数据库连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gitnotes',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 初始化数据库表
async function initDatabase() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('数据库表初始化完成');
  } catch (error) {
    console.error('数据库表初始化失败:', error.message);
  }
}

initDatabase();

// 测试数据库连接
app.get('/api/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    connection.release();
    res.json({ status: 'ok', message: '数据库连接正常' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 用户注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: '用户名长度必须在3到20个字符之间' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度不能少于6个字符' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword]
    );

    const user = { id: result.insertId, username };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: '用户名已存在' });
    }
    res.status(500).json({ error: error.message });
  }
});

// 用户登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const dbUser = rows[0];
    const isMatch = await bcrypt.compare(password, dbUser.password);

    if (!isMatch) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const user = { id: dbUser.user_id, username: dbUser.username };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取所有代码片段
app.get('/api/snippets', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM snippets ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建代码片段
app.post('/api/snippets', async (req, res) => {
  try {
    const { title, language, code_content, tags } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO snippets (title, language, code_content, tags) VALUES (?, ?, ?, ?)',
      [title, language, code_content, JSON.stringify(tags || [])]
    );
    res.json({ id: result.insertId, message: '代码片段创建成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 搜索代码片段
app.get('/api/snippets/search', async (req, res) => {
  try {
    const { q } = req.query;
    const [rows] = await pool.execute(
      'SELECT * FROM snippets WHERE title LIKE ? OR code_content LIKE ? ORDER BY created_at DESC',
      [`%${q}%`, `%${q}%`]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI标签推荐
app.post('/api/ai/tags', async (req, res) => {
  try {
    const { code } = req.body;
    
    // 这里调用AI API，暂时返回模拟数据
    // 实际使用时替换为真实的AI API调用
    const mockTags = ['递归', '文件操作', 'Python'];
    
    res.json({ tags: mockTags });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
