const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ============================================================
// 内存数据库（模拟数据，可替换为MySQL）
// ============================================================
let snippets = [
  {
    snippet_id: 1, user_id: 1,
    title: '快速排序算法', language: 'javascript',
    code_content: 'function quickSort(arr) {\n  if (arr.length <= 1) return arr;\n  const pivot = arr[0];\n  const left = arr.slice(1).filter(x => x < pivot);\n  const right = arr.slice(1).filter(x => x >= pivot);\n  return [...quickSort(left), pivot, ...quickSort(right)];\n}',
    tags: '["算法","排序","递归"]',
    created_at: '2026-05-01 10:00:00', updated_at: '2026-05-01 10:00:00'
  },
  {
    snippet_id: 2, user_id: 1,
    title: 'Python文件遍历', language: 'python',
    code_content: 'import os\n\ndef traverse_directory(path):\n    for root, dirs, files in os.walk(path):\n        for file in files:\n            print(os.path.join(root, file))',
    tags: '["文件操作","Python","递归"]',
    created_at: '2026-05-02 11:00:00', updated_at: '2026-05-02 11:00:00'
  },
  {
    snippet_id: 3, user_id: 1,
    title: 'React useState Hook', language: 'javascript',
    code_content: 'import { useState } from "react";\n\nfunction Counter() {\n  const [count, setCount] = useState(0);\n  return (\n    <button onClick={() => setCount(count + 1)}>\n      Count: {count}\n    </button>\n  );\n}',
    tags: '["React","Hook","前端"]',
    created_at: '2026-05-03 12:00:00', updated_at: '2026-05-03 12:00:00'
  },
  {
    snippet_id: 4, user_id: 1,
    title: 'Java单例模式', language: 'java',
    code_content: 'public class Singleton {\n    private static volatile Singleton instance;\n    \n    private Singleton() {}\n    \n    public static Singleton getInstance() {\n        if (instance == null) {\n            synchronized (Singleton.class) {\n                if (instance == null) {\n                    instance = new Singleton();\n                }\n            }\n        }\n        return instance;\n    }\n}',
    tags: '["设计模式","Java","单例"]',
    created_at: '2026-05-04 14:00:00', updated_at: '2026-05-04 14:00:00'
  },
  {
    snippet_id: 5, user_id: 1,
    title: 'CSS Flexbox居中', language: 'css',
    code_content: '.container {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  min-height: 100vh;\n}',
    tags: '["CSS","布局","前端"]',
    created_at: '2026-05-05 09:00:00', updated_at: '2026-05-05 09:00:00'
  },
  {
    snippet_id: 6, user_id: 1,
    title: 'Python装饰器', language: 'python',
    code_content: 'import functools\nimport time\n\ndef timer(func):\n    @functools.wraps(func)\n    def wrapper(*args, **kwargs):\n        start = time.perf_counter()\n        result = func(*args, **kwargs)\n        elapsed = time.perf_counter() - start\n        print(f"{func.__name__} took {elapsed:.2f}s")\n        return result\n    return wrapper\n\n@timer\ndef slow_function():\n    time.sleep(1)',
    tags: '["Python","装饰器","性能"]',
    created_at: '2026-05-06 16:00:00', updated_at: '2026-05-06 16:00:00'
  },
  {
    snippet_id: 7, user_id: 1,
    title: 'Node.js Express中间件', language: 'javascript',
    code_content: 'const logger = (req, res, next) => {\n  console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);\n  next();\n};\n\napp.use(logger);',
    tags: '["Node.js","Express","中间件"]',
    created_at: '2026-05-07 10:00:00', updated_at: '2026-05-07 10:00:00'
  },
  {
    snippet_id: 8, user_id: 1,
    title: 'SQL联表查询', language: 'sql',
    code_content: 'SELECT u.username, COUNT(s.snippet_id) as snippet_count\nFROM users u\nLEFT JOIN snippets s ON u.user_id = s.user_id\nGROUP BY u.user_id\nORDER BY snippet_count DESC;',
    tags: '["SQL","查询","联表"]',
    created_at: '2026-05-08 11:00:00', updated_at: '2026-05-08 11:00:00'
  }
];

let studyLogs = [
  { log_id: 1, user_id: 1, title: '学习快速排序', content: '## 快速排序算法\n\n今天学习了快速排序算法，理解了分治思想。\n\n### 核心思路\n1. 选择基准元素（pivot）\n2. 将数组分为两部分\n3. 递归排序\n\n时间复杂度：**O(nlogn)**', study_hours: 2.5, log_date: '2026-05-01', created_at: '2026-05-01 22:00:00' },
  { log_id: 2, user_id: 1, title: 'React Hooks深入', content: '## React Hooks\n\n深入理解了useState和useEffect的工作原理。\n\n### useState\n- 函数式更新\n- 惰性初始化\n\n### useEffect\n- 依赖数组\n- 清理函数', study_hours: 3.0, log_date: '2026-05-02', created_at: '2026-05-02 23:00:00' },
  { log_id: 3, user_id: 1, title: 'Python高级特性', content: '## Python装饰器与生成器\n\n### 装饰器\n- 函数装饰器\n- 类装饰器\n- 带参数装饰器\n\n### 生成器\n- yield关键字\n- 惰性求值', study_hours: 2.0, log_date: '2026-05-03', created_at: '2026-05-03 21:00:00' },
  { log_id: 4, user_id: 1, title: '数据库优化学习', content: '## SQL性能优化\n\n### 索引优化\n- 联合索引\n- 覆盖索引\n\n### 查询优化\n- 避免SELECT *\n- 合理使用JOIN', study_hours: 1.5, log_date: '2026-05-05', created_at: '2026-05-05 22:00:00' },
  { log_id: 5, user_id: 1, title: 'CSS Grid布局', content: '## CSS Grid布局系统\n\n### 核心概念\n- grid-template-columns\n- grid-template-rows\n- gap\n\n### 实战\n完成了响应式导航栏布局', study_hours: 2.0, log_date: '2026-05-06', created_at: '2026-05-06 23:00:00' },
  { log_id: 6, user_id: 1, title: 'Node.js后端开发', content: '## Express框架\n\n### 中间件机制\n- 应用级中间件\n- 路由级中间件\n- 错误处理中间件\n\n### RESTful API设计', study_hours: 3.5, log_date: '2026-05-07', created_at: '2026-05-07 23:00:00' },
  { log_id: 7, user_id: 1, title: 'Git高级操作', content: '## Git进阶\n\n### 分支策略\n- Git Flow\n- Rebase vs Merge\n\n### 实用技巧\n- git stash\n- git cherry-pick\n- git bisect', study_hours: 1.0, log_date: '2026-05-08', created_at: '2026-05-08 22:00:00' }
];

let nextSnippetId = 9;
let nextLogId = 8;

// ============================================================
// DeepSeek AI 服务
// ============================================================

/**
 * 调用DeepSeek API进行代码分析
 * @param {string} prompt - 提示词
 * @param {string} code - 代码内容
 * @returns {string} AI返回的文本
 */
async function callDeepSeek(prompt, code) {
  const apiKey = process.env.AI_API_KEY;
  
  // 如果没有配置API Key，使用本地规则引擎降级
  if (!apiKey || apiKey === 'your_api_key_here') {
    return null; // 返回null表示需要降级处理
  }

  try {
    const response = await axios.post('https://api.deepseek.com/chat/completions', {
      model: 'deepseek-chat',
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
      timeout: 10000 // 10秒超时
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('DeepSeek API调用失败:', error.message);
    return null; // 降级处理
  }
}

/**
 * 本地规则引擎（AI服务不可用时的降级方案）
 * @param {string} code - 代码内容
 * @returns {string[]} 推荐标签
 */
function localTagEngine(code) {
  const rules = [
    { keywords: ['function', '=>', 'def ', 'func '], tag: '函数' },
    { keywords: ['class ', 'struct ', 'interface '], tag: '类/对象' },
    { keywords: ['for ', 'while ', 'forEach', 'for...in', 'for...of'], tag: '循环' },
    { keywords: ['if ', 'else', 'switch ', 'case '], tag: '条件判断' },
    { keywords: ['import ', 'require(', 'from ', '#include'], tag: '模块化' },
    { keywords: ['async ', 'await ', 'Promise', '.then('], tag: '异步编程' },
    { keywords: ['try ', 'catch', 'except ', 'finally'], tag: '异常处理' },
    { keywords: ['SELECT ', 'INSERT ', 'UPDATE ', 'DELETE ', 'JOIN'], tag: '数据库' },
    { keywords: ['useState', 'useEffect', 'useRef', 'useCallback'], tag: 'React Hook' },
    { keywords: ['console.log', 'print(', 'System.out'], tag: '调试输出' },
    { keywords: ['map(', 'filter(', 'reduce(', 'find('], tag: '函数式编程' },
    { keywords: ['addEventListener', 'onClick', 'onChange', 'onSubmit'], tag: '事件处理' },
    { keywords: ['fetch(', 'axios', 'http.request', 'XMLHttpRequest'], tag: '网络请求' },
    { keywords: ['fs.', 'path.', 'os.', 'readFile', 'writeFile'], tag: '文件操作' },
    { keywords: ['@', 'decorator', 'functools.wraps'], tag: '装饰器' },
    { keywords: ['return ', 'yield '], tag: '返回值' },
    { keywords: ['const ', 'let ', 'var ', 'int ', 'string '], tag: '变量声明' },
    { keywords: ['sort(', 'quickSort', 'mergeSort', 'binarySearch'], tag: '算法' },
    { keywords: ['display:', 'flex', 'grid', 'position:', 'margin:', 'padding:'], tag: 'CSS布局' },
    { keywords: ['express', 'app.get', 'app.post', 'router.'], tag: 'Express框架' },
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
// API路由 - 健康检查
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Git笔记服务器运行正常', mode: 'mock' });
});

// ============================================================
// API路由 - 代码片段
// ============================================================

// 获取所有代码片段
app.get('/api/snippets', (req, res) => {
  const { language, tag } = req.query;
  let result = [...snippets];

  if (language) {
    result = result.filter(s => s.language === language);
  }
  if (tag) {
    result = result.filter(s => s.tags.includes(tag));
  }

  res.json(result);
});

// 获取单个代码片段
app.get('/api/snippets/:id', (req, res) => {
  const snippet = snippets.find(s => s.snippet_id === parseInt(req.params.id));
  if (!snippet) return res.status(404).json({ error: '代码片段不存在' });
  res.json(snippet);
});

// 创建代码片段
app.post('/api/snippets', (req, res) => {
  const { title, language, code_content, tags } = req.body;
  if (!title || !code_content) {
    return res.status(400).json({ error: '标题和代码内容不能为空' });
  }
  const newSnippet = {
    snippet_id: nextSnippetId++,
    user_id: 1,
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

// 删除代码片段
app.delete('/api/snippets/:id', (req, res) => {
  const id = parseInt(req.params.id);
  snippets = snippets.filter(s => s.snippet_id !== id);
  res.json({ message: '删除成功' });
});

// 搜索代码片段（关键词搜索）
app.get('/api/snippets/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json(snippets);
  const filtered = snippets.filter(s =>
    s.title.toLowerCase().includes(q.toLowerCase()) ||
    s.code_content.toLowerCase().includes(q.toLowerCase()) ||
    s.tags.toLowerCase().includes(q.toLowerCase())
  );
  res.json(filtered);
});

// AI语义搜索（自然语言搜索代码片段）
app.post('/api/snippets/semantic-search', async (req, res) => {
  const { query } = req.body;

  // 尝试调用DeepSeek进行语义匹配
  const snippetList = snippets.map(s => `ID:${s.snippet_id} 标题:${s.title} 语言:${s.language} 标签:${s.tags}`);
  const prompt = `你是一个代码搜索助手。用户想找代码片段，请根据用户的自然语言描述，从以下代码片段列表中找出最相关的3-5个，只返回ID号，用逗号分隔，不要其他内容。\n\n代码片段列表：\n${snippetList.join('\n')}\n\n用户查询：${query}`;

  const aiResult = await callDeepSeek(prompt, '');

  if (aiResult) {
    // 解析AI返回的ID列表
    const ids = aiResult.match(/\d+/g);
    if (ids && ids.length > 0) {
      const matched = snippets.filter(s => ids.includes(String(s.snippet_id)));
      return res.json(matched);
    }
  }

  // 降级：关键词搜索
  const keywords = query.toLowerCase().split(/\s+/);
  const scored = snippets.map(s => {
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
// API路由 - AI标签推荐
// ============================================================
app.post('/api/ai/tags', async (req, res) => {
  const { code } = req.body;
  if (!code || code.trim().length < 5) {
    return res.status(400).json({ error: '代码内容太短' });
  }

  // 截取前500字符发送给AI（控制token消耗）
  const codePreview = code.substring(0, 500);
  const prompt = `你是一位资深代码审查专家。请分析以下代码片段，生成3-5个精准的分类标签。
要求：
1. 标签用中文
2. 简洁明了，每个标签2-4个字
3. 只返回JSON数组格式，不要其他内容
4. 示例格式：["递归","文件操作","数据清洗"]

代码：
${codePreview}`;

  const aiResult = await callDeepSeek(prompt, '');

  if (aiResult) {
    try {
      // 尝试解析AI返回的JSON
      const jsonMatch = aiResult.match(/\[.*?\]/s);
      if (jsonMatch) {
        const tags = JSON.parse(jsonMatch[0]);
        return res.json({ tags, source: 'deepseek' });
      }
    } catch (e) {
      console.error('AI标签解析失败，使用降级方案');
    }
  }

  // 降级：使用本地规则引擎
  const tags = localTagEngine(code);
  res.json({ tags, source: 'local' });
});

// ============================================================
// API路由 - 学习日志
// ============================================================

// 获取所有学习日志
app.get('/api/logs', (req, res) => {
  res.json(studyLogs);
});

// 获取单个学习日志
app.get('/api/logs/:id', (req, res) => {
  const log = studyLogs.find(l => l.log_id === parseInt(req.params.id));
  if (!log) return res.status(404).json({ error: '日志不存在' });
  res.json(log);
});

// 创建学习日志
app.post('/api/logs', (req, res) => {
  const { title, content, study_hours, log_date } = req.body;
  if (!title) return res.status(400).json({ error: '标题不能为空' });

  const newLog = {
    log_id: nextLogId++,
    user_id: 1,
    title,
    content: content || '',
    study_hours: study_hours || 0,
    log_date: log_date || new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString()
  };
  studyLogs.unshift(newLog);
  res.json({ id: newLog.log_id, message: '日志创建成功' });
});

// 更新学习日志
app.put('/api/logs/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const log = studyLogs.find(l => l.log_id === id);
  if (!log) return res.status(404).json({ error: '日志不存在' });

  const { title, content, study_hours, log_date } = req.body;
  if (title) log.title = title;
  if (content !== undefined) log.content = content;
  if (study_hours !== undefined) log.study_hours = study_hours;
  if (log_date) log.log_date = log_date;

  res.json({ message: '日志更新成功' });
});

// 删除学习日志
app.delete('/api/logs/:id', (req, res) => {
  const id = parseInt(req.params.id);
  studyLogs = studyLogs.filter(l => l.log_id !== id);
  res.json({ message: '删除成功' });
});

// ============================================================
// API路由 - 统计看板
// ============================================================

// 获取统计数据
app.get('/api/stats', (req, res) => {
  // 1. 语言分布统计
  const languageMap = {};
  snippets.forEach(s => {
    languageMap[s.language] = (languageMap[s.language] || 0) + 1;
  });
  const languageDistribution = Object.entries(languageMap).map(([name, value]) => ({
    name, value
  }));

  // 2. 每日学习时长统计（最近14天）
  const dailyStudy = {};
  for (let i = 13; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    dailyStudy[dateStr] = 0;
  }
  studyLogs.forEach(log => {
    if (dailyStudy.hasOwnProperty(log.log_date)) {
      dailyStudy[log.log_date] += log.study_hours;
    }
  });
  const dailyStudyData = Object.entries(dailyStudy).map(([date, hours]) => ({
    date,
    hours: parseFloat(hours.toFixed(1))
  }));

  // 3. 活跃天数热力图（最近12周，按周统计）
  const heatmapData = [];
  for (let i = 83; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayLogs = studyLogs.filter(l => l.log_date === dateStr);
    const daySnippets = snippets.filter(s => s.created_at && s.created_at.startsWith(dateStr));
    const count = dayLogs.length + daySnippets.length;
    heatmapData.push({
      date: dateStr,
      count,
      level: count === 0 ? 0 : count <= 1 ? 1 : count <= 2 ? 2 : count <= 3 ? 3 : 4
    });
  }

  // 4. 总览数据
  const totalSnippets = snippets.length;
  const totalLogs = studyLogs.length;
  const totalHours = studyLogs.reduce((sum, l) => sum + l.study_hours, 0);
  const totalTags = new Set(snippets.flatMap(s => JSON.parse(s.tags || '[]'))).size;
  const activeDays = new Set([
    ...studyLogs.map(l => l.log_date),
    ...snippets.map(s => s.created_at ? s.created_at.split('T')[0] : '')
  ]).size;

  // 5. 标签使用频率TOP10
  const tagMap = {};
  snippets.forEach(s => {
    JSON.parse(s.tags || '[]').forEach(tag => {
      tagMap[tag] = (tagMap[tag] || 0) + 1;
    });
  });
  const topTags = Object.entries(tagMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }));

  // 6. 学习时长按语言分布
  const langHours = {};
  studyLogs.forEach(log => {
    // 简单关联：根据日志标题关键词匹配语言
    const langKeywords = {
      'javascript': ['React', 'Hook', 'Node', 'Express', 'JavaScript', 'JS', '前端', 'Vue'],
      'python': ['Python', '装饰器', '生成器', 'Django', 'Flask'],
      'java': ['Java', 'Spring', 'JVM'],
      'sql': ['SQL', '数据库', 'MySQL', 'Redis'],
      'css': ['CSS', 'Grid', 'Flex', '布局', '样式'],
      'html': ['HTML', 'DOM', '页面'],
    };
    for (const [lang, keywords] of Object.entries(langKeywords)) {
      if (keywords.some(kw => log.title.includes(kw) || log.content.includes(kw))) {
        langHours[lang] = (langHours[lang] || 0) + log.study_hours;
        break;
      }
    }
  });
  const languageHours = Object.entries(langHours).map(([name, value]) => ({
    name, value: parseFloat(value.toFixed(1))
  }));

  res.json({
    overview: { totalSnippets, totalLogs, totalHours: parseFloat(totalHours.toFixed(1)), totalTags, activeDays },
    languageDistribution,
    dailyStudy: dailyStudyData,
    heatmap: heatmapData,
    topTags,
    languageHours
  });
});

// ============================================================
// 启动服务器
// ============================================================
app.listen(PORT, () => {
  console.log(`╔══════════════════════════════════════╗`);
  console.log(`║   Git笔记 后端服务已启动              ║`);
  console.log(`║   地址: http://localhost:${PORT}          ║`);
  console.log(`║   模式: 模拟数据（无需MySQL）          ║`);
  console.log(`║   AI:   DeepSeek API（含降级策略）     ║`);
  console.log(`╚══════════════════════════════════════╝`);
});
