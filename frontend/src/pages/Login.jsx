import React, { useState } from 'react'
import api from '../api.js'
import './Login.css'

function Login({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true)
  const [form, setForm] = useState({ username: '', password: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (!isLogin && form.password !== form.confirmPassword) {
      setMessage('两次输入的密码不一致')
      setLoading(false)
      return
    }

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register'
      const response = await api.post(endpoint, {
        username: form.username,
        password: form.password
      })

      if (!isLogin) {
        // 注册成功，显示消息并切换到登录表单
        setMessage('注册成功！请登录')
        setIsLogin(true)
        setForm({ ...form, password: '', confirmPassword: '' })
        setLoading(false)
        return
      }

      // 保存token到localStorage
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data.user))
      
      onLogin(response.data.user)
    } catch (error) {
      setMessage(error.response?.data?.error || '操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1 className="logo">
            <span className="logo-icon">⚡</span>
            Git笔记
          </h1>
          <p className="logo-sub">程序员的工匠手账</p>
        </div>

        <div className="login-box">
          <h2>{isLogin ? '欢迎回来' : '创建账号'}</h2>
          <p className="login-desc">
            {isLogin ? '登录以管理你的代码片段和学习日志' : '注册开始记录你的编程成长'}
          </p>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label>用户名</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="请输入用户名"
                required
                minLength={3}
                maxLength={20}
              />
            </div>

            <div className="form-group">
              <label>密码</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="请输入密码"
                required
                minLength={6}
              />
            </div>

            {!isLogin && (
              <div className="form-group">
                <label>确认密码</label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="请再次输入密码"
                  required
                  minLength={6}
                />
              </div>
            )}

            {message && (
              <div className={`message ${message.includes('成功') ? 'success' : 'error'}`}>
                {message}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '处理中...' : (isLogin ? '登录' : '注册')}
            </button>
          </form>

          <div className="login-footer">
            <p>
              {isLogin ? '还没有账号？' : '已有账号？'}
              <button
                className="link-btn"
                onClick={() => {
                  setIsLogin(!isLogin)
                  setMessage('')
                  setForm({ username: '', password: '', confirmPassword: '' })
                }}
              >
                {isLogin ? '立即注册' : '立即登录'}
              </button>
            </p>
          </div>
        </div>

        <div className="login-quote">
          <p>"工匠之路，始于日积月累"</p>
        </div>
      </div>
    </div>
  )
}

export default Login
