const express = require('express');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ============================================================
// 内存数据库（生产环境应替换为MySQL/PostgreSQL）
// ============================================================
let users = [];
let snippets = [];
let studyLogs = [];
let nextUserId = 1;
let nextSnippetId = 1;
let nextLogId = 1;

// ============================================================
// 用量统计（内存存储，生产环境应持久化到数据库）
// ============================================================
const usageStats = {
  today: new Date().toISOString().split('T')[0],
  totalUsers: 0,       // 今日独立用户数
  totalCalls: 0,       // 今日AI调用次数
  totalTokens: 0,      // 今日消耗Token数
  dailyHistory: []     // 历史记录
};

// 每日零点重置
const checkDayReset = () => {
  const today = new Date().toISOString().split('T')[0];
  if (usageStats.today !== today) {
    // 保存昨日数据到历史
    usageStats.dailyHistory.push({
      date: usageStats.today,
      users: usageStats.totalUsers,
      calls: usageStats.totalCalls,
      tokens: usageStats.totalTokens
    });
    // 只保留最近30天
    if (usageStats.dailyHistory.length > 30) {
      usageStats.dailyHistory.shift();
    }
    // 重置今日统计
    usageStats.today = today;
    usageStats.totalUsers = 0;
    usageStats.totalCalls = 0;
    usageStats.totalTokens = 0;
  }
};

// 记录一次AI调用
const recordUsage = (userId) => {
  checkDayReset();
  usageStats.totalCalls++;
  // 用Set去重统计独立用户（简化：直接计数，生产环境用Set）
  usageStats.totalUsers = Math.max(usageStats.totalUsers, userId);
};

// 初始化一个默认用户
const initDefaultUser = async () => {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  users.push({
    user_id: nextUserId++,
    username: 'admin',
    password: hashedPassword,
    created_at: new Date().toISOString()
  });
};
initDefaultUser();

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
        timeout: 30000  // 增加超时到30秒
      });

      // 记录Token消耗（Kimi API返回usage字段）
      const usage = response.data.usage;
      if (usage) {
        checkDayReset();
        usageStats.totalTokens += (usage.total_tokens || 0);
      }

      console.log('Kimi: 调用成功!');
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error(`Kimi: 第${attempt}次尝试失败 - ${error.message}`);
      
      // 如果是429（过载）或5xx错误，且还有重试次数，则等待后重试
      if ((error.response?.status === 429 || error.response?.status >= 500) && attempt < retries) {
        const waitTime = delay * attempt;
        console.log(`Kimi: 服务器过载，${waitTime/1000}秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // 最后一次失败或非重试错误
      if (attempt === retries) {
        console.error('Kimi: 所有重试失败，返回null触发本地降级');
      }
    }
  }
  
  return null;
}

// 本地规则引擎（AI服务不可用时的降级方案）
function localTagEngine(code) {
  const rules = [
    { keywords: ['function', '=>', 'def ', 'func '], tag: '函数' },
    { keywords: ['class ', 'struct ', 'interface '], tag: '类/对象' },
    { keywords: ['for ', 'while ', 'forEach'], tag: '循环' },
    { keywords: ['if ', 'else', 'switch '], tag: '条件判断' },
    { keywords: ['import ', 'require(', 'from '], tag: '模块化' },
    { keywords: ['async ', 'await ', 'Promise'], tag: '异步编程' },
    { keywords: ['try ', 'catch', 'except '], tag: '异常处理' },
    { keywords: ['SELECT ', 'INSERT ', 'UPDATE '], tag: '数据库' },
    { keywords: ['useState', 'useEffect', 'useRef'], tag: 'React Hook' },
    { keywords: ['console.log', 'print('], tag: '调试输出' },
    { keywords: ['map(', 'filter(', 'reduce('], tag: '函数式编程' },
    { keywords: ['addEventListener', 'onClick'], tag: '事件处理' },
    { keywords: ['fetch(', 'axios'], tag: '网络请求' },
    { keywords: ['fs.', 'readFile', 'writeFile'], tag: '文件操作' },
    { keywords: ['return ', 'yield '], tag: '返回值' },
    { keywords: ['sort(', 'quickSort'], tag: '算法' },
    { keywords: ['display:', 'flex', 'grid'], tag: 'CSS布局' },
  ];

  const matchedTags = [];
  const seen = new Set();

  for (const rule of rules) {
    for (const kw of rule.keywords) {
      if (code.includes(kw) && !seen.has(rule.tag)) {
        matchedTags.push(rule.tag);
        seen.add(rule.tag);
        break;
      }
    }
  }

  return matchedTags.length > 0 ? matchedTags.slice(0, 5) : ['代码片段', '待分类'];
}

// ============================================================
// 用户认证API
// ============================================================

// 用户注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: '用户名长度应在3-20个字符之间' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少为6个字符' });
    }
    
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
      return res.status(409).json({ error: '用户名已被注册' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = {
      user_id: nextUserId++,
      username,
      password: hashedPassword,
      created_at: new Date().toISOString()
    };
    
    users.push(newUser);
    
    const token = jwt.sign(
      { userId: newUser.user_id, username: newUser.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      message: '注册成功',
      token,
      user: {
        user_id: newUser.user_id,
        username: newUser.username
      }
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

// 用户登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    const user = users.find(u => u.username === username);
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    const token = jwt.sign(
      { userId: user.user_id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      message: '登录成功',
      token,
      user: {
        user_id: user.user_id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

// 验证令牌
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: {
      user_id: req.user.userId,
      username: req.user.username
    }
  });
});

// ============================================================
// 代码片段API
// ============================================================

app.get('/api/snippets', authenticateToken, (req, res) => {
  const { language, tag } = req.query;
  const userId = req.user.userId;
  
  let result = snippets.filter(s => s.user_id === userId);
  
  if (language) {
    result = result.filter(s => s.language === language);
  }
  if (tag) {
    result = result.filter(s => s.tags.includes(tag));
  }
  
  res.json(result);
});

app.post('/api/snippets', authenticateToken, (req, res) => {
  const { title, language, code_content, tags } = req.body;
  const userId = req.user.userId;
  
  if (!title || !code_content) {
    return res.status(400).json({ error: '标题和代码内容不能为空' });
  }
  
  const newSnippet = {
    snippet_id: nextSnippetId++,
    user_id: userId,
    title,
    language: language || 'javascript',
    code_content,
    tags: JSON.stringify(tags || []),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  snippets.unshift(newSnippet);
  res.json({ id: newSnippet.snippet_id, message: '代码片段创建成功' });
});

app.delete('/api/snippets/:id', authenticateToken, (req, res) => {
  const id = parseInt(req.params.id);
  const userId = req.user.userId;
  
  const snippet = snippets.find(s => s.snippet_id === id && s.user_id === userId);
  if (!snippet) {
    return res.status(404).json({ error: '代码片段不存在或无权限删除' });
  }
  
  snippets = snippets.filter(s => !(s.snippet_id === id && s.user_id === userId));
  res.json({ message: '删除成功' });
});

app.get('/api/snippets/search', authenticateToken, (req, res) => {
  const { q } = req.query;
  const userId = req.user.userId;
  
  let result = snippets.filter(s => s.user_id === userId);
  
  if (!q) return res.json(result);
  
  const filtered = result.filter(s =>
    s.title.toLowerCase().includes(q.toLowerCase()) ||
    s.code_content.toLowerCase().includes(q.toLowerCase()) ||
    s.tags.toLowerCase().includes(q.toLowerCase())
  );
  
  res.json(filtered);
});

app.post('/api/snippets/semantic-search', authenticateToken, async (req, res) => {
  const { query } = req.body;
  const userId = req.user.userId;
  
  const userSnippets = snippets.filter(s => s.user_id === userId);
  
  const snippetList = userSnippets.map(s => `ID:${s.snippet_id} 标题:${s.title} 语言:${s.language}`);
  const prompt = `从以下代码片段中找出最相关的3-5个，只返回ID号，用逗号分隔。\n\n${snippetList.join('\n')}\n\n查询：${query}`;
  
  const aiResult = await callKimi(prompt, '');
  
  if (aiResult) {
    const ids = aiResult.match(/\d+/g);
    if (ids && ids.length > 0) {
      const matched = userSnippets.filter(s => ids.includes(String(s.snippet_id)));
      return res.json(matched);
    }
  }
  
  const keywords = query.toLowerCase().split(/\s+/);
  const scored = userSnippets.map(s => {
    let score = 0;
    const text = `${s.title} ${s.tags} ${s.language}`.toLowerCase();
    keywords.forEach(kw => {
      if (text.includes(kw)) score += 2;
      if (s.code_content.toLowerCase().includes(kw)) score += 1;
    });
    return { ...s, score };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  
  res.json(scored);
});

// ============================================================
// AI标签推荐 - Kimi
// ============================================================
app.post('/api/ai/tags', authenticateToken, async (req, res) => {
  const { code } = req.body;
  
  if (!code || code.trim().length < 5) {
    return res.status(400).json({ error: '代码内容太短' });
  }
  
  const codePreview = code.substring(0, 500);
  const prompt = `你是一个代码分析专家。请分析下面的代码，只返回一个JSON数组格式的标签列表（如["递归","排序","分治"]），不要有任何其他文字解释。`;
  
  // 记录本次AI调用
  recordUsage(req.user.userId);
  
  const aiResult = await callKimi(prompt, codePreview);
  
  if (aiResult) {
    try {
      // 尝试多种方式解析标签
      let tags = null;
      
      // 方式1: 标准JSON数组
      const jsonMatch = aiResult.match(/\[.*?\]/s);
      if (jsonMatch) {
        try {
          tags = JSON.parse(jsonMatch[0]);
        } catch (e) {
          // JSON解析失败，继续尝试其他方式
        }
      }
      
      // 方式2: 如果上面失败，尝试提取引号中的中文词组
      if (!tags || !Array.isArray(tags)) {
        const chineseTags = aiResult.match(/[""'']?([\u4e00-\u9fa5]{2,6})[""'']?(?:\s*,\s*|\s*])/g);
        if (chineseTags) {
          tags = chineseTags.map(t => t.replace(/[""''\[\],]/g, '').trim()).filter(t => t.length >= 2);
        }
      }
      
      // 方式3: 逗号分隔的中文词组
      if (!tags || !Array.isArray(tags) || tags.length === 0) {
        const commaTags = aiResult.split(/[,，、]/).map(t => t.replace(/[""''\[\]]/g, '').trim()).filter(t => t.length >= 2 && /[\u4e00-\u9fa5]/.test(t));
        if (commaTags.length > 0) {
          tags = commaTags.slice(0, 5);
        }
      }
      
      // 最终验证
      if (tags && Array.isArray(tags) && tags.length > 0) {
        // 清理标签：去除空白和特殊字符
        tags = tags.map(t => t.replace(/[\[\]"'\s]/g, '').trim()).filter(t => t.length >= 2);
        if (tags.length > 0) {
          return res.json({ tags: tags.slice(0, 5), source: 'kimi' });
        }
      }
    } catch (e) {
      console.error('Kimi标签解析失败:', e.message);
    }
  }
  
  // 所有方式都失败，使用本地引擎
  const tags = localTagEngine(code);
  res.json({ tags, source: 'local' });
});

// ============================================================
// 学习日志API
// ============================================================

app.get('/api/logs', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const userLogs = studyLogs.filter(l => l.user_id === userId);
  res.json(userLogs);
});

app.post('/api/logs', authenticateToken, (req, res) => {
  const { title, content, study_hours, log_date } = req.body;
  const userId = req.user.userId;
  
  if (!title) {
    return res.status(400).json({ error: '标题不能为空' });
  }
  
  const newLog = {
    log_id: nextLogId++,
    user_id: userId,
    title,
    content: content || '',
    study_hours: study_hours || 0,
    log_date: log_date || new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString()
  };
  
  studyLogs.unshift(newLog);
  res.json({ id: newLog.log_id, message: '日志创建成功' });
});

app.delete('/api/logs/:id', authenticateToken, (req, res) => {
  const id = parseInt(req.params.id);
  const userId = req.user.userId;
  
  const log = studyLogs.find(l => l.log_id === id && l.user_id === userId);
  if (!log) {
    return res.status(404).json({ error: '日志不存在或无权限删除' });
  }
  
  studyLogs = studyLogs.filter(l => !(l.log_id === id && l.user_id === userId));
  res.json({ message: '删除成功' });
});

// ============================================================
// 统计看板API
// ============================================================
app.get('/api/stats', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  
  const userSnippets = snippets.filter(s => s.user_id === userId);
  const userLogs = studyLogs.filter(l => l.user_id === userId);
  
  const languageMap = {};
  userSnippets.forEach(s => {
    languageMap[s.language] = (languageMap[s.language] || 0) + 1;
  });
  const languageDistribution = Object.entries(languageMap).map(([name, value]) => ({ name, value }));
  
  const dailyStudy = {};
  for (let i = 13; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dailyStudy[date.toISOString().split('T')[0]] = 0;
  }
  userLogs.forEach(log => {
    if (dailyStudy.hasOwnProperty(log.log_date)) {
      dailyStudy[log.log_date] += log.study_hours;
    }
  });
  const dailyStudyData = Object.entries(dailyStudy).map(([date, hours]) => ({
    date,
    hours: parseFloat(hours.toFixed(1))
  }));
  
  const heatmapData = [];
  for (let i = 83; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayLogs = userLogs.filter(l => l.log_date === dateStr);
    const daySnippets = userSnippets.filter(s => s.created_at && s.created_at.startsWith(dateStr));
    const count = dayLogs.length + daySnippets.length;
    heatmapData.push({ date: dateStr, count, level: count === 0 ? 0 : count <= 1 ? 1 : count <= 2 ? 2 : count <= 3 ? 3 : 4 });
  }
  
  const totalSnippets = userSnippets.length;
  const totalLogs = userLogs.length;
  const totalHours = userLogs.reduce((sum, l) => sum + l.study_hours, 0);
  const totalTags = new Set(userSnippets.flatMap(s => JSON.parse(s.tags || '[]'))).size;
  const activeDays = new Set([...userLogs.map(l => l.log_date), ...userSnippets.map(s => s.created_at ? s.created_at.split('T')[0] : '')]).size;
  
  const tagMap = {};
  userSnippets.forEach(s => {
    JSON.parse(s.tags || '[]').forEach(tag => {
      tagMap[tag] = (tagMap[tag] || 0) + 1;
    });
  });
  const topTags = Object.entries(tagMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }));
  
  res.json({
    overview: { totalSnippets, totalLogs, totalHours: parseFloat(totalHours.toFixed(1)), totalTags, activeDays },
    languageDistribution,
    dailyStudy: dailyStudyData,
    heatmap: heatmapData,
    topTags,
    languageHours: []
  });
});

// ============================================================
// 用量统计API（需要认证）
// ============================================================
app.get('/api/usage', authenticateToken, (req, res) => {
  checkDayReset();
  res.json({
    today: {
      date: usageStats.today,
      users: usageStats.totalUsers,
      calls: usageStats.totalCalls,
      tokens: usageStats.totalTokens
    },
    history: usageStats.dailyHistory.slice(-7) // 最近7天
  });
});

// ============================================================
// 健康检查
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Git笔记服务器运行正常',
    mode: 'production',
    ai: process.env.AI_API_KEY ? 'Kimi AI' : '本地降级模式'
  });
});

// ============================================================
// 启动服务器
// ============================================================
app.listen(PORT, () => {
  console.log(`╔══════════════════════════════════════╗`);
  console.log(`║   Git笔记 生产环境服务已启动          ║`);
  console.log(`║   地址: http://localhost:${PORT}          ║`);
  console.log(`║   模式: 多用户 + JWT认证              ║`);
  console.log(`║   AI:   ${process.env.AI_API_KEY ? 'Kimi AI' : '本地降级模式'}     ║`);
  console.log(`╚══════════════════════════════════════╝`);
});
