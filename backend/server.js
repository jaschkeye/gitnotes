const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

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
