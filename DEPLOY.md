# Git笔记 - 部署到互联网指南

## 快速部署到 Render（推荐免费方案）

### 1. 准备工作

1. 注册 [Render](https://render.com/) 账号
2. 将代码推送到 GitHub/GitLab
3. 准备 DeepSeek API Key（可选，用于AI功能）

### 2. 部署后端服务

1. 在 Render Dashboard 点击 "New +" → "Web Service"
2. 选择你的代码仓库
3. 配置：
   - **Name**: gitnotes-backend
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server-prod.js`
4. 添加环境变量：
   - `AI_API_KEY`: 你的 DeepSeek API Key
   - `JWT_SECRET`: 随机字符串（用于JWT签名）
5. 点击 "Create Web Service"

### 3. 部署前端

1. 在 Render Dashboard 点击 "New +" → "Static Site"
2. 选择同一个代码仓库
3. 配置：
   - **Name**: gitnotes-frontend
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish Directory**: `frontend/dist`
4. 添加环境变量：
   - `VITE_API_URL`: `https://gitnotes-backend.onrender.com/api`
5. 点击 "Create Static Site"

### 4. 更新前端API地址

修改 `frontend/src/api.js`：

```javascript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
```

### 5. 自定义域名（可选）

1. 在 Render 的 Static Site 设置中添加自定义域名
2. 按照提示配置 DNS

## 部署到其他平台

### Vercel（仅前端）

```bash
cd frontend
npm install
vercel
```

后端需要单独部署到支持 Node.js 的平台。

### 云服务器（完整部署）

1. 购买云服务器（阿里云/腾讯云/AWS等）
2. 安装 Node.js 和 Nginx
3. 上传代码，安装依赖
4. 使用 PM2 启动后端：`pm2 start server-prod.js`
5. Nginx 配置反向代理到后端
6. 配置 SSL 证书

## 数据持久化（生产环境必需）

当前使用内存存储，生产环境建议：

1. **Render PostgreSQL**: 在 Render 创建 PostgreSQL 服务
2. **修改数据库连接**: 更新 `server-prod.js` 使用真实数据库
3. **数据迁移**: 导出导入现有数据

## 完成！

部署完成后，你将拥有：
- ✅ 独立的用户系统（注册/登录）
- ✅ 多用户数据隔离
- ✅ HTTPS 安全访问
- ✅ 互联网可访问的URL
- ✅ AI智能标签（配置API Key后）

访问你的前端URL即可使用！
