const express = require('express');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 中间件 - CORS 允许所有来源（生产环境可限制）
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// ============================================================
// MySQL 连接池（Railway自动注入环境变量）
// ============================================================
let pool = null;
let useDatabase = false;

async function initDatabase() {
  try {
    if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME) {
      pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });
      
      // 测试连接
      const conn = await pool.getConnection();
      conn.release();
      
      console.log('✅ MySQL 连接池已就绪');
      useDatabase = true;
      
      // 初始化数据库表
      await initTables();
    } else {
      console.log('⚠️ 未配置数据库环境变量，使用内存存储');
      useDatabase = false;
    }
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    console.log('⚠️ 回退到内存存储');
    useDatabase = false;
  }
}

async function initTables() {
  try {
    // 创建用户表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 创建代码片段表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS snippets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        language VARCHAR(50) NOT NULL,
        tags JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // 创建学习日志表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS study_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        study_date DATE NOT NULL,
        duration_minutes INT DEFAULT 0,
        tags JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 创建用量统计表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS usage_stats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        stat_date DATE UNIQUE NOT NULL,
        total_users INT DEFAULT 0,
        total_calls INT DEFAULT 0,
        total_tokens INT DEFAULT 0
      )
    `);
    
    console.log('✅ 数据库表初始化完成');
  } catch (error) {
    console.error('❌ 数据库表初始化失败:', error.message);
  }
}

// ============================================================
// 内存数据库（备用，当MySQL不可用时）
// ============================================================
let memoryUsers = [];
let memorySnippets = [];
let memoryStudyLogs = [];
let nextUserId = 1;
let nextSnippetId = 1;
let nextLogId = 1;

// ============================================================
// 用量统计
// ============================================================
const usageStats = {
  today: new Date().toISOString().split('T')[0],
  totalUsers: 0,
  totalCalls: 0,
  totalTokens: 0,
  dailyHistory: []
};

const checkDayReset = () => {
  const today = new Date().toISOString().split('T')[0];
  if (usageStats.today !== today) {
    usageStats.dailyHistory.push({
      date: usageStats.today,
      users: usageStats.totalUsers,
      calls: usageStats.totalCalls,
      tokens: usageStats.totalTokens
    });
    if (usageStats.dailyHistory.length > 30) {
      usageStats.dailyHistory.shift();
    }
    usageStats.today = today;
    usageStats.totalUsers = 0;
    usageStats.totalCalls = 0;
    usageStats.totalTokens = 0;
  }
};

const recordUsage = (userId) => {
  checkDayReset();
  usageStats.totalCalls++;
  usageStats.totalUsers = Math.max(usageStats.totalUsers, userId);
};

// 初始化默认用户
const initDefaultUser = async () => {
  if (useDatabase) {
    try {
      const [existing] = await pool.execute('SELECT * FROM users WHERE username = ?', ['admin']);
      if (existing.length === 0) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await pool.execute(
          'INSERT INTO users (username, password) VALUES (?, ?)',
          ['admin', hashedPassword]
        );
        console.log('✅ 默认用户admin已创建');
      }
    } catch (error) {
      console.error('❌ 创建默认用户失败:', error.message);
    }
  } else {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    memoryUsers.push({
      user_id: nextUserId++,
      username: 'admin',
      password: hashedPassword,
      created_at: new Date().toISOString()
    });
  }
};

// ============================================================
// JWT认证中间件
// ============================================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: '未提供访问令牌' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '令牌无效或已过期' });
    }
    // 标准化userId字段，兼容token中id或userId两种命名
    req.user = {
      userId: user.userId || user.id,
      username: user.username
    };
    next();
  });
};

// ============================================================
// Kimi AI 服务（带重试机制）
// ============================================================
async function callKimi(prompt, code, retries = 3, delay = 2000) {
  const apiKey = process.env.AI_API_KEY;
  
  if (!apiKey || apiKey === 'your_api_key_here') {
    console.log('Kimi: 未配置API Key');
    return null;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Kimi: 第${attempt}次尝试调用...`);
      
      const response = await axios.post('https://api.moonshot.cn/v1/chat/completions', {
        model: 'moonshot-v1-8k',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: code }
        ],
        temperature: 0.3,
        max_tokens: 500
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const usage = response.data.usage;
      if (usage) {
        checkDayReset();
        usageStats.totalTokens += (usage.total_tokens || 0);
      }

      console.log('Kimi: 调用成功!');
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error(`Kimi: 第${attempt}次尝试失败 - ${error.message}`);
      
      if ((error.response?.status === 429 || error.response?.status >= 500) && attempt < retries) {
        const waitTime = delay * attempt;
        console.log(`Kimi: 服务器过载，${waitTime/1000}秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (attempt === retries) {
        console.error('Kimi: 所有重试失败，返回null触发本地降级');
      }
    }
  }
  
  return null;
}

// ============================================================
// 本地标签引擎
// ============================================================
function localTagEngine(code) {
  const tags = new Set();
  
  const patterns = {
    '递归': /\b(recursion|recursive|function.*calls?.*itself)\b|\b\w+\s*\([^)]*\)\s*\{[\s\S]*?\b\w+\s*\([^)]*\)\s*\{/i,
    '排序': /\b(sort|sorted|bubble|quick|merge|heap)\b|\b(arrays?|lists?)\s*\.\s*sort\b/i,
    '分治': /\b(divide.*conquer|binary.*search|merge.*sort|quick.*sort)\b/i,
    '动态规划': /\b(dp|dynamic.*programming|memoization|fibonacci|knapsack)\b/i,
    '贪心': /\b(greedy|optimal|minimum|maximum)\b/i,
    '回溯': /\b(backtrack|backtracking|permutation|combination)\b/i,
    '树': /\b(tree|binary|node|root|leaf|bst)\b/i,
    '图': /\b(graph|vertex|edge|dfs|bfs|dijkstra)\b/i,
    '链表': /\b(linked.*list|listnode|next|pointer)\b/i,
    '栈': /\b(stack|push|pop|peek)\b/i,
    '队列': /\b(queue|enqueue|dequeue|fifo)\b/i,
    '哈希': /\b(hash|map|dict|set|key.*value)\b/i,
    '字符串': /\b(string|char|substring|regex|match)\b/i,
    '数组': /\b(array|list\[|index|length)\b/i,
    '异步': /\b(async|await|promise|callback|then)\b/i,
    '错误处理': /\b(try|catch|error|exception|throw)\b/i,
    'API': /\b(fetch|axios|http|request|api)\b/i,
    'DOM': /\b(document|window|querySelector|getElementById)\b/i,
    '事件': /\b(event|listener|click|submit|onload)\b/i,
    '组件': /\b(component|props|state|render|jsx)\b/i
  };
  
  for (const [tag, pattern] of Object.entries(patterns)) {
    if (pattern.test(code)) {
      tags.add(tag);
    }
  }
  
  return Array.from(tags).slice(0, 5);
}

// ============================================================
// 认证路由
// ============================================================

// 用户注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    if (useDatabase) {
      const [result] = await pool.execute(
        'INSERT INTO users (username, password) VALUES (?, ?)',
        [username, hashedPassword]
      );
      
      const token = jwt.sign({ id: result.insertId, username }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ 
        message: '注册成功', 
        token,
        user: { user_id: result.insertId, username }
      });
    } else {
      if (memoryUsers.find(u => u.username === username)) {
        return res.status(400).json({ error: '用户名已存在' });
      }
      
      const newUser = {
        user_id: nextUserId++,
        username,
        password: hashedPassword,
        created_at: new Date().toISOString()
      };
      memoryUsers.push(newUser);
      
      const token = jwt.sign({ userId: newUser.user_id, username }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ 
        message: '注册成功', 
        token,
        user: { user_id: newUser.user_id, username }
      });
    }
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ error: '注册失败: ' + error.message });
  }
});

// 用户登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    let user;
    if (useDatabase) {
      const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
      user = rows[0];
    } else {
      user = memoryUsers.find(u => u.username === username);
    }
    
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    const userId = user.id || user.user_id;
    const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      message: '登录成功', 
      token,
      user: { user_id: userId, username }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '登录失败: ' + error.message });
  }
});

// ============================================================
// 代码片段路由
// ============================================================

// 获取代码片段列表
app.get('/api/snippets', authenticateToken, async (req, res) => {
  try {
    const { language, search } = req.query;
    let snippets;
    
    if (useDatabase) {
      let query = 'SELECT id, user_id, title, content, language, tags, created_at FROM snippets WHERE user_id = ?';
      const params = [req.user.userId];
      
      if (language && language !== 'all') {
        query += ' AND language = ?';
        params.push(language);
      }
      
      if (search) {
        query += ' AND (title LIKE ? OR content LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }
      
      query += ' ORDER BY created_at DESC';
      
      const [rows] = await pool.execute(query, params);
      snippets = rows.map(row => ({
        ...row,
        snippet_id: row.id,
        code_content: row.content,
        tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || [])
      }));
    } else {
      snippets = memorySnippets
        .filter(s => s.user_id === req.user.userId)
        .filter(s => !language || language === 'all' || s.language === language)
        .filter(s => !search || s.title.includes(search) || s.code_content.includes(search))
        .reverse();
    }
    
    res.json(snippets);
  } catch (error) {
    console.error('获取代码片段失败:', error);
    res.status(500).json({ error: '获取代码片段失败' });
  }
});

// 创建代码片段
app.post('/api/snippets', authenticateToken, async (req, res) => {
  try {
    const { title, language, code_content, tags } = req.body;
    
    if (useDatabase) {
      const [result] = await pool.execute(
        'INSERT INTO snippets (user_id, title, content, language, tags) VALUES (?, ?, ?, ?, ?)',
        [req.user.userId, title, content, language, JSON.stringify(tags || [])]
      );
      
      res.json({ 
        message: '保存成功', 
        snippet_id: result.insertId 
      });
    } else {
      const newSnippet = {
        snippet_id: nextSnippetId++,
        user_id: req.user.userId,
        title,
        language,
        code_content,
        tags: tags || [],
        created_at: new Date().toISOString()
      };
      memorySnippets.push(newSnippet);
      
      res.json({ 
        message: '保存成功', 
        snippet_id: newSnippet.snippet_id 
      });
    }
  } catch (error) {
    console.error('保存代码片段失败:', error);
    res.status(500).json({ error: '保存代码片段失败' });
  }
});

// AI标签推荐
app.post('/api/snippets/analyze', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    
    recordUsage(req.user.userId);
    
    const prompt = '你是一个代码分析专家。请分析下面的代码，只返回一个JSON数组格式的标签列表（如["递归","排序","分治"]），不要有任何其他文字解释。';
    
    const aiResult = await callKimi(prompt, code);
    
    if (aiResult) {
      try {
        let tags = null;
        const jsonMatch = aiResult.match(/\[.*?\]/s);
        if (jsonMatch) {
          try { tags = JSON.parse(jsonMatch[0]); } catch (e) {}
        }
        
        if (!tags || !Array.isArray(tags)) {
          const chineseTags = aiResult.match(/[""'']?([\u4e00-\u9fa5]{2,6})[""'']?(?:\s*,\s*|\s*])/g);
          if (chineseTags) {
            tags = chineseTags.map(t => t.replace(/[""''\[\],]/g, '').trim()).filter(t => t.length >= 2);
          }
        }
        
        if (!tags || !Array.isArray(tags) || tags.length === 0) {
          const commaTags = aiResult.split(/[,，、]/).map(t => t.replace(/[""''\[\]]/g, '').trim()).filter(t => t.length >= 2 && /[\u4e00-\u9fa5]/.test(t));
          if (commaTags.length > 0) { tags = commaTags.slice(0, 5); }
        }
        
        if (tags && Array.isArray(tags) && tags.length > 0) {
          tags = tags.map(t => t.replace(/[\[\]"'\s]/g, '').trim()).filter(t => t.length >= 2);
          if (tags.length > 0) { return res.json({ tags: tags.slice(0, 5), source: 'kimi' }); }
        }
      } catch (e) { console.error('Kimi标签解析失败:', e.message); }
    }
    
    const tags = localTagEngine(code);
    res.json({ tags, source: 'local' });
  } catch (error) {
    console.error('AI分析失败:', error);
    const tags = localTagEngine(code);
    res.json({ tags, source: 'local' });
  }
});

// ============================================================
// 学习日志路由
// ============================================================

// 获取学习日志列表
app.get('/api/study-logs', authenticateToken, async (req, res) => {
  try {
    let logs;
    
    if (useDatabase) {
      const [rows] = await pool.execute(
        'SELECT id, user_id, title, content, study_date, duration_minutes, tags, created_at FROM study_logs WHERE user_id = ? ORDER BY study_date DESC',
        [req.user.userId]
      );
      logs = rows.map(row => ({
        ...row,
        log_id: row.id,
        tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || [])
      }));
    } else {
      logs = memoryStudyLogs
        .filter(l => l.user_id === req.user.userId)
        .sort((a, b) => new Date(b.study_date) - new Date(a.study_date));
    }
    
    res.json(logs);
  } catch (error) {
    console.error('获取学习日志失败:', error);
    res.status(500).json({ error: '获取学习日志失败' });
  }
});

// 创建学习日志
app.post('/api/study-logs', authenticateToken, async (req, res) => {
  try {
    const { title, content, study_date, duration_minutes, tags } = req.body;
    
    if (useDatabase) {
      const [result] = await pool.execute(
        'INSERT INTO study_logs (user_id, title, content, study_date, duration_minutes, tags) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.userId, title, content, study_date, duration_minutes || 0, JSON.stringify(tags || [])]
      );
      
      res.json({ 
        message: '保存成功', 
        log_id: result.insertId 
      });
    } else {
      const newLog = {
        log_id: nextLogId++,
        user_id: req.user.userId,
        title,
        content,
        study_date,
        duration_minutes: duration_minutes || 0,
        tags: tags || [],
        created_at: new Date().toISOString()
      };
      memoryStudyLogs.push(newLog);
      
      res.json({ 
        message: '保存成功', 
        log_id: newLog.log_id 
      });
    }
  } catch (error) {
    console.error('保存学习日志失败:', error);
    res.status(500).json({ error: '保存学习日志失败' });
  }
});

// ============================================================
// 统计路由
// ============================================================

// 获取统计数据
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    let stats = {
      totalSnippets: 0,
      totalLogs: 0,
      totalStudyMinutes: 0,
      languageDistribution: [],
      recentActivity: []
    };
    
    if (useDatabase) {
      const [snippetCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM snippets WHERE user_id = ?',
        [req.user.userId]
      );
      stats.totalSnippets = snippetCount[0].count;
      
      const [logData] = await pool.execute(
        'SELECT COUNT(*) as count, SUM(duration_minutes) as total_minutes FROM study_logs WHERE user_id = ?',
        [req.user.userId]
      );
      stats.totalLogs = logData[0].count;
      stats.totalStudyMinutes = logData[0].total_minutes || 0;
      
      const [langDist] = await pool.execute(
        'SELECT language, COUNT(*) as count FROM snippets WHERE user_id = ? GROUP BY language',
        [req.user.userId]
      );
      stats.languageDistribution = langDist;
    } else {
      const userSnippets = memorySnippets.filter(s => s.user_id === req.user.userId);
      const userLogs = memoryStudyLogs.filter(l => l.user_id === req.user.userId);
      
      stats.totalSnippets = userSnippets.length;
      stats.totalLogs = userLogs.length;
      stats.totalStudyMinutes = userLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
      
      const langCount = {};
      userSnippets.forEach(s => {
        langCount[s.language] = (langCount[s.language] || 0) + 1;
      });
      stats.languageDistribution = Object.entries(langCount).map(([language, count]) => ({ language, count }));
    }
    
    res.json(stats);
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

// 获取用量统计
app.get('/api/usage', authenticateToken, (req, res) => {
  checkDayReset();
  res.json({
    today: usageStats.today,
    totalUsers: usageStats.totalUsers,
    totalCalls: usageStats.totalCalls,
    totalTokens: usageStats.totalTokens,
    history: usageStats.dailyHistory.slice(-7)
  });
});

// ============================================================
// 管理后台 Dashboard
// ============================================================
app.get('/admin', (req, res) => {
  checkDayReset();
  const totalUsers = useDatabase ? 'N/A' : memoryUsers.length;
  const totalSnippets = useDatabase ? 'N/A' : memorySnippets.length;
  const totalLogs = useDatabase ? 'N/A' : memoryStudyLogs.length;
  
  res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitNotes 管理后台</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif; background: #f0f2f5; color: #333; }
    .layout { display: flex; min-height: 100vh; }
    
    /* 侧边栏 */
    .sidebar { width: 240px; background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%); color: #fff; padding: 0; display: flex; flex-direction: column; }
    .sidebar-logo { padding: 24px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .sidebar-logo h2 { font-size: 20px; font-weight: 700; }
    .sidebar-logo span { font-size: 12px; color: rgba(255,255,255,0.5); display: block; margin-top: 4px; }
    .sidebar-nav { flex: 1; padding: 12px 0; }
    .sidebar-nav a { display: flex; align-items: center; padding: 12px 20px; color: rgba(255,255,255,0.7); text-decoration: none; font-size: 14px; transition: all 0.2s; gap: 10px; }
    .sidebar-nav a:hover, .sidebar-nav a.active { background: rgba(255,255,255,0.08); color: #fff; border-left: 3px solid #3498db; }
    .sidebar-nav a .icon { font-size: 18px; width: 24px; text-align: center; }
    .sidebar-footer { padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 12px; color: rgba(255,255,255,0.4); }
    
    /* 主内容 */
    .main { flex: 1; display: flex; flex-direction: column; }
    .header { height: 60px; background: #fff; border-bottom: 1px solid #e8e8e8; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; }
    .header h3 { font-size: 16px; color: #555; }
    .header .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #27ae60; margin-right: 6px; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .content { flex: 1; padding: 24px; overflow-y: auto; }
    
    /* 状态卡片 */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); display: flex; align-items: center; gap: 16px; transition: transform 0.2s; }
    .stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; }
    .stat-icon.blue { background: #e3f2fd; color: #1976d2; }
    .stat-icon.green { background: #e8f5e9; color: #388e3c; }
    .stat-icon.orange { background: #fff3e0; color: #f57c00; }
    .stat-icon.purple { background: #f3e5f5; color: #7b1fa2; }
    .stat-icon.red { background: #ffebee; color: #c62828; }
    .stat-info h4 { font-size: 24px; font-weight: 700; margin-bottom: 2px; }
    .stat-info p { font-size: 13px; color: #888; }
    
    /* 面板 */
    .panel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    @media (max-width: 768px) { .panel-grid { grid-template-columns: 1fr; } .sidebar { display: none; } }
    .panel { background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow: hidden; }
    .panel-header { padding: 16px 20px; border-bottom: 1px solid #f0f0f0; font-size: 15px; font-weight: 600; display: flex; align-items: center; justify-content: space-between; }
    .panel-body { padding: 16px 20px; }
    .panel.full { grid-column: 1 / -1; }
    
    /* 表格 */
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 10px 12px; background: #fafafa; color: #666; font-weight: 600; border-bottom: 2px solid #f0f0f0; }
    td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; color: #444; }
    tr:hover td { background: #fafafa; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge-get { background: #e8f5e9; color: #2e7d32; }
    .badge-post { background: #e3f2fd; color: #1565c0; }
    .badge-auth { background: #fff3e0; color: #e65100; }
    .badge-ok { background: #e8f5e9; color: #2e7d32; }
    .badge-warn { background: #fff3e0; color: #e65100; }
    
    /* 进度条 */
    .progress-bar { height: 6px; background: #f0f0f0; border-radius: 3px; margin-top: 8px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #3498db, #2ecc71); transition: width 0.5s; }
    
    /* 日志 */
    .log-list { max-height: 200px; overflow-y: auto; }
    .log-item { padding: 8px 0; border-bottom: 1px solid #f5f5f5; font-size: 13px; font-family: 'Consolas', 'Courier New', monospace; }
    .log-time { color: #999; margin-right: 8px; }
    .log-ok { color: #27ae60; }
    .log-err { color: #e74c3c; }
    .log-warn { color: #f39c12; }
    
    .empty-state { text-align: center; padding: 32px; color: #999; }
    .empty-state .icon { font-size: 40px; margin-bottom: 8px; }
    .refresh-btn { background: #3498db; color: #fff; border: none; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; transition: background 0.2s; }
    .refresh-btn:hover { background: #2980b9; }
  </style>
</head>
<body>
  <div class="layout">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <div class="sidebar-logo">
        <h2>⚡ GitNotes</h2>
        <span>管理后台 v1.0</span>
      </div>
      <nav class="sidebar-nav">
        <a href="#overview" class="active" onclick="showTab('overview')"><span class="icon">📊</span> 系统概览</a>
        <a href="#api" onclick="showTab('api')"><span class="icon">🔌</span> API 接口</a>
        <a href="#users" onclick="showTab('users')"><span class="icon">👥</span> 用户管理</a>
        <a href="#logs" onclick="showTab('logs')"><span class="icon">📋</span> 运行日志</a>
      </nav>
      <div class="sidebar-footer">© 2026 GitNotes Team</div>
    </aside>
    
    <!-- 主区域 -->
    <main class="main">
      <header class="header">
        <h3><span class="status-dot"></span> 服务运行中</h3>
        <div style="display:flex;align-items:center;gap:16px">
          <span style="font-size:13px;color:#888" id="serverTime"></span>
          <button class="refresh-btn" onclick="refreshAll()">🔄 刷新数据</button>
        </div>
      </header>
      
      <div class="content">
        <!-- Tab: 概览 -->
        <div id="tab-overview">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon blue">👥</div>
              <div class="stat-info"><h4 id="sTotalUsers">-</h4><p>注册用户</p></div>
            </div>
            <div class="stat-card">
              <div class="stat-icon green">📝</div>
              <div class="stat-info"><h4 id="sTotalSnippets">-</h4><p>代码片段</p></div>
            </div>
            <div class="stat-card">
              <div class="stat-icon orange">🤖</div>
              <div class="stat-info"><h4 id="sTotalCalls">-</h4><p>今日AI调用</p></div>
            </div>
            <div class="stat-card">
              <div class="stat-icon purple">🔤</div>
              <div class="stat-info"><h4 id="sTotalTokens">-</h4><p>今日Token消耗</p></div>
            </div>
          </div>
          
          <div class="panel-grid">
            <div class="panel">
              <div class="panel-header">🖥 系统信息</div>
              <div class="panel-body">
                <table>
                  <tr><td style="color:#888">Node.js</td><td id="siNode">-</td></tr>
                  <tr><td style="color:#888">运行时间</td><td id="siUptime">-</td></tr>
                  <tr><td style="color:#888">数据库</td><td id="siDatabase">-</td></tr>
                  <tr><td style="color:#888">内存使用</td><td id="siMemory">-</td></tr>
                  <tr><td style="color:#888">端口</td><td id="siPort">-</td></tr>
                </table>
              </div>
            </div>
            
            <div class="panel">
              <div class="panel-header">📈 服务健康度</div>
              <div class="panel-body">
                <div style="margin-bottom:12px">
                  <span style="font-size:13px">API 响应状态</span>
                  <span class="badge badge-ok" style="float:right" id="hApi">检测中...</span>
                  <div class="progress-bar"><div class="progress-fill" style="width:100%"></div></div>
                </div>
                <div style="margin-bottom:12px">
                  <span style="font-size:13px">数据库连接</span>
                  <span class="badge badge-ok" style="float:right" id="hDb">检测中...</span>
                  <div class="progress-bar"><div class="progress-fill" style="width:100%"></div></div>
                </div>
                <div style="margin-bottom:12px">
                  <span style="font-size:13px">Kimi AI 状态</span>
                  <span class="badge badge-warn" style="float:right" id="hAi">检测中...</span>
                  <div class="progress-bar"><div class="progress-fill" style="width:80%"></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Tab: API 接口 -->
        <div id="tab-api" style="display:none">
          <div class="panel full">
            <div class="panel-header">🔌 API 接口列表</div>
            <div class="panel-body">
              <table>
                <thead>
                  <tr><th>方法</th><th>路径</th><th>说明</th><th>认证</th></tr>
                </thead>
                <tbody>
                  <tr><td><span class="badge badge-post">POST</span></td><td><code>/api/auth/register</code></td><td>用户注册</td><td>-</td></tr>
                  <tr><td><span class="badge badge-post">POST</span></td><td><code>/api/auth/login</code></td><td>用户登录</td><td>-</td></tr>
                  <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/snippets</code></td><td>获取代码片段列表</td><td><span class="badge badge-auth">JWT</span></td></tr>
                  <tr><td><span class="badge badge-post">POST</span></td><td><code>/api/snippets</code></td><td>创建代码片段</td><td><span class="badge badge-auth">JWT</span></td></tr>
                  <tr><td><span class="badge badge-post">POST</span></td><td><code>/api/snippets/analyze</code></td><td>AI标签推荐</td><td><span class="badge badge-auth">JWT</span></td></tr>
                  <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/study-logs</code></td><td>获取学习日志</td><td><span class="badge badge-auth">JWT</span></td></tr>
                  <tr><td><span class="badge badge-post">POST</span></td><td><code>/api/study-logs</code></td><td>创建学习日志</td><td><span class="badge badge-auth">JWT</span></td></tr>
                  <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/stats</code></td><td>获取统计数据</td><td><span class="badge badge-auth">JWT</span></td></tr>
                  <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/usage</code></td><td>用量统计</td><td><span class="badge badge-auth">JWT</span></td></tr>
                  <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/health</code></td><td>健康检查</td><td>-</td></tr>
                  <tr><td><span class="badge badge-get">GET</span></td><td><code>/admin</code></td><td>管理后台</td><td>-</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <!-- Tab: 用户管理 -->
        <div id="tab-users" style="display:none">
          <div class="panel full">
            <div class="panel-header">👥 用户列表 <span style="font-size:12px;color:#999;font-weight:400">（内存模式显示）</span></div>
            <div class="panel-body" id="userTableBody">
              <div class="empty-state"><div class="icon">⏳</div>加载中...</div>
            </div>
          </div>
        </div>
        
        <!-- Tab: 日志 -->
        <div id="tab-logs" style="display:none">
          <div class="panel full">
            <div class="panel-header">📋 运行日志</div>
            <div class="panel-body">
              <div class="log-list" id="logList">
                <div class="log-item"><span class="log-time">--:--:--</span> <span class="log-ok">[INFO]</span> 管理后台已就绪</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
  
  <script>
    // Tab切换
    function showTab(name) {
      document.querySelectorAll('[id^="tab-"]').forEach(el => el.style.display = 'none');
      document.getElementById('tab-' + name).style.display = 'block';
      document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
      document.querySelectorAll('.sidebar-nav a').forEach(a => { if(a.getAttribute('href') === '#' + name) a.classList.add('active'); });
      if (name === 'users') loadUsers();
      if (name === 'logs') loadLogs();
    }
    
    // 刷新全部
    async function refreshAll() {
      try {
        const resp = await fetch('/api/health');
        const data = await resp.json();
        
        document.getElementById('sTotalUsers').textContent = data.totalUsers || '-';
        document.getElementById('sTotalSnippets').textContent = data.totalSnippets || '-';
        document.getElementById('sTotalCalls').textContent = data.totalCalls || '0';
        document.getElementById('sTotalTokens').textContent = data.totalTokens || '0';
        
        document.getElementById('siNode').textContent = data.nodeVersion || '-';
        document.getElementById('siUptime').textContent = data.uptime || '-';
        document.getElementById('siDatabase').textContent = data.database === 'connected' ? '✅ MySQL 已连接' : '⚠️ 内存存储';
        document.getElementById('siMemory').textContent = data.memory || '-';
        document.getElementById('siPort').textContent = data.port || '3001';
        
        document.getElementById('hApi').textContent = '正常';
        document.getElementById('hApi').className = 'badge badge-ok';
        document.getElementById('hDb').textContent = data.database === 'connected' ? '已连接' : '内存模式';
        document.getElementById('hDb').className = data.database === 'connected' ? 'badge badge-ok' : 'badge badge-warn';
        document.getElementById('hAi').textContent = data.aiConfigured ? '已配置' : '未配置';
        document.getElementById('hAi').className = data.aiConfigured ? 'badge badge-ok' : 'badge badge-warn';
        
        const log = document.getElementById('logList');
        log.innerHTML += '<div class="log-item"><span class="log-time">' + new Date().toLocaleTimeString() + '</span> <span class="log-ok">[OK]</span> 数据刷新成功</div>';
        if (log.children.length > 50) log.removeChild(log.firstChild);
        log.scrollTop = log.scrollHeight;
      } catch(e) {
        const log = document.getElementById('logList');
        log.innerHTML += '<div class="log-item"><span class="log-time">' + new Date().toLocaleTimeString() + '</span> <span class="log-err">[ERR]</span> ' + e.message + '</div>';
      }
    }
    
    async function loadUsers() {
      try {
        const resp = await fetch('/api/admin/users');
        const users = await resp.json();
        const tbody = document.getElementById('userTableBody');
        if (!users || users.length === 0) {
          tbody.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>暂无用户数据</p></div>';
          return;
        }
        tbody.innerHTML = '<table><thead><tr><th>ID</th><th>用户名</th><th>注册时间</th><th>状态</th></tr></thead><tbody>' +
          users.map(u => '<tr><td>' + u.user_id + '</td><td><strong>' + u.username + '</strong></td><td>' + (u.created_at ? new Date(u.created_at).toLocaleString() : '-') + '</td><td><span class="badge badge-ok">活跃</span></td></tr>').join('') +
          '</tbody></table>';
      } catch(e) {
        document.getElementById('userTableBody').innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>加载失败: ' + e.message + '</p></div>';
      }
    }
    
    function loadLogs() {
      // 日志已在刷新时写入
    }
    
    // 实时时钟
    setInterval(() => {
      document.getElementById('serverTime').textContent = new Date().toLocaleString('zh-CN');
    }, 1000);
    
    // 自动刷新
    setInterval(refreshAll, 30000);
    
    // 初始加载
    refreshAll();
    document.getElementById('serverTime').textContent = new Date().toLocaleString('zh-CN');
  </script>
</body>
</html>`);
});

// 管理后台数据 API
app.get('/api/admin/users', (req, res) => {
  if (useDatabase) {
    pool.execute('SELECT id, username, created_at FROM users ORDER BY created_at DESC')
      .then(([rows]) => res.json(rows.map(r => ({ ...r, user_id: r.id }))))
      .catch(() => res.json([]));
  } else {
    res.json(memoryUsers.map(u => ({
      user_id: u.user_id,
      username: u.username,
      created_at: u.created_at
    })));
  }
});

// ============================================================
// 健康检查（增强版 - 含管理后台数据）
// ============================================================
app.get('/api/health', (req, res) => {
  checkDayReset();
  const memUsage = process.memoryUsage();
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: useDatabase ? 'connected' : 'memory',
    version: '1.0.0',
    nodeVersion: process.version,
    port: PORT,
    uptime: Math.floor(process.uptime()) + '秒',
    memory: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
    aiConfigured: !!(process.env.AI_API_KEY && process.env.AI_API_KEY !== 'your_api_key_here'),
    totalUsers: useDatabase ? '数据库模式' : memoryUsers.length,
    totalSnippets: useDatabase ? '数据库模式' : memorySnippets.length,
    totalCalls: usageStats.totalCalls,
    totalTokens: usageStats.totalTokens
  });
});

// ============================================================
// 启动服务
// ============================================================
async function startServer() {
  await initDatabase();
  await initDefaultUser();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log('╔══════════════════════════════════════╗');
    console.log('║     GitNotes 生产环境服务已启动      ║');
    console.log(`║     端口: ${PORT} (0.0.0.0)            ║`);
    console.log(`║     数据库: ${useDatabase ? 'MySQL 连接池' : '内存'}        ║`);
    console.log('║     JWT认证: 已启用                  ║');
    console.log('╚══════════════════════════════════════╝');
  });
}

startServer().catch(console.error);
