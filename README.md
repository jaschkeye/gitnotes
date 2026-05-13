# Git笔记 - 程序员的工匠手账

> 一个专为程序员设计的代码片段管理+学习记录工具，让日常积累的每一段代码、每一个Bug修复、每一次技术突破都有迹可循。

## 项目简介

**Git笔记**是为程序员打造的工匠手账，将碎片化积累变成结构化的成长轨迹。每个程序员都遇到过这个问题——上周写的一段好代码，这周找不到了。笔记散落在Typora、Notion、GitHub Gist、甚至微信收藏里。Git笔记专门解决这个问题，让代码积累的过程成为可展示的工匠作品。

### 思政融合点

**"工匠之路，始于日积月累"**——作品本身就是对"工匠精神"的产品化诠释。引导"专注、坚持、精益求精"的学习习惯，不硬套，评委能感知到。

## 核心功能

### 已完成功能

1. **代码片段库**
   - 创建、编辑、分类存储代码片段
   - Monaco Editor专业语法高亮（VS Code同款内核）
   - 多语言支持（JavaScript、Python、Java、C++、HTML、CSS、SQL）
   - 标签管理

2. **AI智能标签**
   - 粘贴代码后，AI自动推荐分类标签
   - 一键应用推荐标签

3. **代码片段列表**
   - 展示所有保存的代码片段
   - 显示语言、标签、创建时间

### 待开发功能

- [ ] 学习日志（Markdown笔记+时间戳）
- [ ] 时间统计看板（ECharts图表）
- [ ] AI语义搜索
- [ ] 学习报告导出

## 技术架构

```
┌──────────────────────┐
│     前端 Web 应用     │  ← React + Monaco Editor + Axios
│    (浏览器端)         │
└──────────┬───────────┘
           │ HTTP API
┌──────────▼───────────┐
│   后端服务 (Node.js)  │  ← Express + CORS + MySQL2
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│      MySQL 数据库     │  ← 代码片段表、日志表
└──────────────────────┘
```

### 核心技术选型

| 层级 | 技术 | 理由 |
|------|------|------|
| 前端框架 | React 18 | 组件化开发，生态丰富 |
| 代码编辑器 | Monaco Editor | VS Code内核，专业语法高亮 |
| HTTP客户端 | Axios | 稳定可靠，拦截器支持 |
| 后端框架 | Express | 轻量、快速出活 |
| 数据库 | MySQL | 关系型数据，笔记和标签关联 |

## 目录结构

```
GitNotes/
├── frontend/           # 前端项目
│   ├── src/
│   │   ├── App.jsx    # 主应用组件
│   │   ├── App.css    # 样式文件
│   │   ├── main.jsx   # 入口文件
│   │   └── index.css  # 全局样式
│   ├── index.html     # HTML模板
│   └── package.json   # 依赖配置
├── backend/           # 后端项目
│   ├── server.js      # 服务器入口
│   ├── database.sql   # 数据库初始化脚本
│   ├── .env          # 环境变量
│   └── package.json   # 依赖配置
└── README.md         # 项目说明
```

## 快速开始

### 1. 初始化数据库

```bash
# 登录MySQL
mysql -u root -p

# 执行初始化脚本
source backend/database.sql
```

### 2. 启动后端服务

```bash
cd backend
npm install
npm start
```

服务器将在 http://localhost:3001 运行

### 3. 启动前端应用

```bash
cd frontend
npm install
npm run dev
```

应用将在 http://localhost:5173 运行

## API接口文档

### 健康检查
```
GET /api/health
```

### 代码片段
```
GET    /api/snippets          # 获取所有代码片段
POST   /api/snippets          # 创建代码片段
GET    /api/snippets/search?q=关键词  # 搜索代码片段
```

### AI功能
```
POST   /api/ai/tags           # AI标签推荐
Body: { "code": "代码内容" }
```

## 数据库表结构

### 代码片段表 (snippets)

| 字段 | 类型 | 说明 |
|------|------|------|
| snippet_id | INT | 主键，自增 |
| user_id | INT | 用户ID |
| title | VARCHAR(200) | 片段标题 |
| language | VARCHAR(30) | 编程语言 |
| code_content | TEXT | 代码内容 |
| tags | VARCHAR(500) | 标签（JSON数组） |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 学习日志表 (study_logs)

| 字段 | 类型 | 说明 |
|------|------|------|
| log_id | INT | 主键，自增 |
| user_id | INT | 用户ID |
| title | VARCHAR(200) | 日志标题 |
| content | TEXT | Markdown内容 |
| study_hours | DECIMAL(3,1) | 学习时长 |
| log_date | DATE | 日期 |
| created_at | DATETIME | 创建时间 |

## 开发计划

| 阶段 | 日期 | 任务 |
|------|------|------|
| 基础搭建 | 5.8 | ✅ 项目脚手架、数据库设计、最简流程 |
| 核心功能 | 5.9-5.10 | 学习日志、代码片段管理完善 |
| AI功能 | 5.11 | 接入真实AI API、语义搜索 |
| 数据可视化 | 5.12 | ECharts统计看板 |
| 测试优化 | 5.13 | 全流程测试、UI美化 |
| 文档编写 | 5.14 | 设计文档、部署说明 |

## 代码质量设计

### 命名规范
- 组件名：CodeSnippetCard.jsx、StudyLogEditor.jsx
- 接口名：POST /api/snippets、GET /api/snippets/search
- 数据库字段：snippet_id, code_content, created_at

### 错误处理
- 全局异常捕获
- API超时提示
- 代码保存失败自动暂存LocalStorage

## 许可证

MIT License
