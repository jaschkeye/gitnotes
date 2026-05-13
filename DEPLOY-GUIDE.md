# Git笔记 - 部署指南

## 📋 部署前准备

### 1. 环境要求
- Node.js 18+
- Git
- Render账号（免费）

### 2. 必须配置的环境变量

| 变量名 | 说明 | 获取方式 |
|--------|------|----------|
| `AI_API_KEY` | Kimi AI API Key | https://platform.moonshot.cn/ |
| `JWT_SECRET` | JWT签名密钥 | 随机生成32位字符串 |

---

## 🚀 方案一：Render 一键部署（推荐）

### 步骤1：创建 GitHub 仓库

```bash
# 在项目根目录初始化Git（如果还没做）
cd GitNotes
git init
git add .
git commit -m "Initial commit"

# 推送到GitHub（替换YOUR_USERNAME）
git remote add origin https://github.com/YOUR_USERNAME/gitnotes.git
git push -u origin main
```

### 步骤2：部署后端服务

1. 登录 [Render](https://render.com/)
2. 点击 **"New +"** → **"Web Service"**
3. 选择你的 GitHub 仓库
4. 配置：
   - **Name**: `gitnotes-backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server-prod.js`
   - **Root Directory**: `backend`
5. 添加环境变量：
   - `AI_API_KEY`: `sk-4eYmHrDPHE4ETrNrsJ2Y1bGi0iviCN1vb0iNv5wikAUXDd5S`
   - `JWT_SECRET`: 生成随机字符串（如 `your-random-secret-key-32chars`）
6. 点击 **"Create Web Service"**

### 步骤3：部署前端

1. 在 Render Dashboard 点击 **"New +"** → **"Static Site"**
2. 选择同一个仓库
3. 配置：
   - **Name**: `gitnotes-frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
   - **Root Directory**: `frontend`
4. 添加环境变量：
   - `VITE_API_URL`: `https://gitnotes-backend-production.up.railway.app/api`（替换为你的Railway后端公共域名）
5. 点击 **"Create Static Site"**

### 步骤4：等待部署完成

- 后端部署约 2-3 分钟
- 前端部署约 1-2 分钟
- 访问前端URL即可使用！

---

## 🚀 方案二：本地打包 + 手动上传

### 构建前端生产包

```bash
cd frontend

# 安装依赖
npm install

# 构建生产包
npm run build

# 构建完成后，dist文件夹即为生产包
```

### 部署到任意静态托管

将 `frontend/dist` 文件夹上传到：
- Vercel
- Netlify
- GitHub Pages
- 腾讯云COS/阿里云OSS
- 自己的服务器

### 后端部署

```bash
cd backend

# 安装依赖
npm install

# 启动服务（生产环境）
node server-prod.js
```

---

## 🔧 生产环境配置

### 1. 修改后端 CORS（如需要）

编辑 `backend/server-prod.js`：

```javascript
// 第13行，添加你的前端域名
app.use(cors({
  origin: ['https://your-frontend-domain.com', 'http://localhost:5173']
}));
```

### 2. 数据持久化（重要！）

当前使用内存存储，重启后数据丢失。生产环境建议：

**方案A：Render PostgreSQL（推荐）**
1. Render Dashboard → "New +" → "PostgreSQL"
2. 复制数据库连接字符串
3. 修改 `server-prod.js` 使用真实数据库

**方案B：使用文件存储（简单）**
修改代码将数据保存到文件而非内存。

---

## ✅ 部署检查清单

- [ ] 后端服务运行正常（访问 `/api/health` 返回ok）
- [ ] 前端能正常访问
- [ ] 注册/登录功能正常
- [ ] 代码片段保存正常
- [ ] AI标签推荐正常（配置API Key后）
- [ ] HTTPS已启用

---

## 🐛 常见问题

### Q: 前端无法连接后端？
A: 检查 `VITE_API_URL` 是否正确指向后端地址

### Q: AI功能不工作？
A: 检查 `AI_API_KEY` 是否正确配置，Kimi API是否有余额

### Q: 数据重启后丢失？
A: 当前是内存存储，需要配置PostgreSQL数据库

---

## 📞 需要帮助？

- Render文档：https://render.com/docs
- Kimi API文档：https://platform.moonshot.cn/
- 项目GitHub：你的仓库地址
