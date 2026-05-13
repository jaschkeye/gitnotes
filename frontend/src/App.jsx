import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Login from './pages/Login'
import Snippets from './pages/Snippets'
import StudyLogs from './pages/StudyLogs'
import Dashboard from './pages/Dashboard'
import UsageStats from './components/UsageStats'
import './App.css'

// 配置axios默认请求头
const token = localStorage.getItem('token')
if (token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

function App() {
  const [user, setUser] = useState(null)
  const [currentPage, setCurrentPage] = useState('snippets')
  const [loading, setLoading] = useState(true)

  // 检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      const savedUser = localStorage.getItem('user')
      const savedToken = localStorage.getItem('token')
      
      if (savedUser && savedToken) {
        try {
          // 验证token是否有效
          await axios.get('http://localhost:3001/api/auth/verify')
          setUser(JSON.parse(savedUser))
        } catch (error) {
          // token无效，清除本地存储
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          delete axios.defaults.headers.common['Authorization']
        }
      }
      setLoading(false)
    }
    
    checkAuth()
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
    axios.defaults.headers.common['Authorization'] = `Bearer ${localStorage.getItem('token')}`
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    delete axios.defaults.headers.common['Authorization']
    setUser(null)
  }

  const navItems = [
    { id: 'snippets', label: '代码片段', icon: '📝' },
    { id: 'logs', label: '学习日志', icon: '📖' },
    { id: 'dashboard', label: '统计看板', icon: '📊' }
  ]

  const renderPage = () => {
    switch (currentPage) {
      case 'snippets': return <Snippets />
      case 'logs': return <StudyLogs />
      case 'dashboard': return <Dashboard />
      default: return <Snippets />
    }
  }

  if (loading) {
    return <div className="loading-screen">加载中...</div>
  }

  // 未登录显示登录页
  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="app-layout">
      {/* 侧边栏 */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="logo">
            <span className="logo-icon">⚡</span>
            Git笔记
          </h1>
          <p className="logo-sub">程序员的工匠手账</p>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => setCurrentPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {currentPage === item.id && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-name">👤 {user.username}</span>
            <button onClick={handleLogout} className="logout-btn">退出</button>
          </div>
          <div className="craftsman-quote">
            <p>"工匠之路，始于日积月累"</p>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="main-content">
        <header className="top-bar">
          <h2 className="page-title">
            {navItems.find(n => n.id === currentPage)?.icon}{' '}
            {navItems.find(n => n.id === currentPage)?.label}
          </h2>
          <div className="top-bar-right">
            <UsageStats />
            <span className="ai-badge">Kimi AI</span>
          </div>
        </header>
        <div className="page-content">
          {renderPage()}
        </div>
      </main>
    </div>
  )
}

export default App
