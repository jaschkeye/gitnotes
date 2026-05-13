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
// MySQL数据库连接配置（Railway自动注入环境变量）
// ============================================================
let db;
let useDatabase = false;

async function initDatabase() {
  try {
    // 检查是否有数据库环境变量
    if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME) {
      db = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
      });
      
      console.log('✅ MySQL数据库连接成功');
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
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 创建代码片段表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS snippets (
        snippet_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        language VARCHAR(50) NOT NULL,
        code_content TEXT NOT NULL,
        tags JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      )
    `);
    
    // 创建学习日志表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS study_logs (
        log_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        study_date DATE NOT NULL,
        duration_minutes INT DEFAULT 0,
        tags JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      )
    `);
    
    // 创建用量统计表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS usage_stats (
        stat_id INT AUTO_INCREMENT PRIMARY KEY,
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
      const [existing] = await db.execute('SELECT * FROM users WHERE username = ?', ['admin']);
      if (existing.length === 0) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await db.execute(
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
    req.user = user;
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
      const [result] = await db.execute(
        'INSERT INTO users (username, password) VALUES (?, ?)',
        [username, hashedPassword]
      );
      
      const token = jwt.sign({ userId: result.insertId, username }, JWT_SECRET, { expiresIn: '7d' });
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
      const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
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
    
    const token = jwt.sign({ userId: user.user_id, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      message: '登录成功', 
      token,
      user: { user_id: user.user_id, username }
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
      let query = 'SELECT * FROM snippets WHERE user_id = ?';
      const params = [req.user.userId];
      
      if (language && language !== 'all') {
        query += ' AND language = ?';
        params.push(language);
      }
      
      if (search) {
        query += ' AND (title LIKE ? OR code_content LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }
      
      query += ' ORDER BY created_at DESC';
      
      const [rows] = await db.execute(query, params);
      snippets = rows.map(row => ({
        ...row,
        tags: JSON.parse(row.tags || '[]')
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
      const [result] = await db.execute(
        'INSERT INTO snippets (user_id, title, language, code_content, tags) VALUES (?, ?, ?, ?, ?)',
        [req.user.userId, title, language, code_content, JSON.stringify(tags || [])]
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
      const [rows] = await db.execute(
        'SELECT * FROM study_logs WHERE user_id = ? ORDER BY study_date DESC',
        [req.user.userId]
      );
      logs = rows.map(row => ({
        ...row,
        tags: JSON.parse(row.tags || '[]')
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
      const [result] = await db.execute(
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
      const [snippetCount] = await db.execute(
        'SELECT COUNT(*) as count FROM snippets WHERE user_id = ?',
        [req.user.userId]
      );
      stats.totalSnippets = snippetCount[0].count;
      
      const [logData] = await db.execute(
        'SELECT COUNT(*) as count, SUM(duration_minutes) as total_minutes FROM study_logs WHERE user_id = ?',
        [req.user.userId]
      );
      stats.totalLogs = logData[0].count;
      stats.totalStudyMinutes = logData[0].total_minutes || 0;
      
      const [langDist] = await db.execute(
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
// 健康检查
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: useDatabase ? 'connected' : 'memory',
    version: '1.0.0'
  });
});

// ============================================================
// 启动服务
// ============================================================
async function startServer() {
  await initDatabase();
  await initDefaultUser();
  
  app.listen(PORT, () => {
    console.log('╔══════════════════════════════════════╗');
    console.log('║     GitNotes 生产环境服务已启动      ║');
    console.log(`║     端口: ${PORT}                      ║`);
    console.log(`║     数据库: ${useDatabase ? 'MySQL' : '内存'}                ║`);
    console.log('╚══════════════════════════════════════╝');
  });
}

startServer().catch(console.error);
