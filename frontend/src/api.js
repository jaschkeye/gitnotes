import axios from 'axios'

// VITE_API_URL is set at build time via frontend/.env.production for Railway deployments.
// Falls back to the Railway internal DNS for server-side rendering scenarios,
// but browser clients must use the public backend URL set in VITE_API_URL.
const API_BASE = import.meta.env.VITE_API_URL || 'https://gitnotes-backend-production.up.railway.app/api'

// 创建axios实例
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器 - 添加token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器 - 处理401错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // token过期或无效，清除登录状态
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.reload()
    }
    return Promise.reject(error)
  }
)

export default api
