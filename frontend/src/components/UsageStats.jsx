import React, { useState, useEffect } from 'react'
import api from '../api'
import './UsageStats.css'

function UsageStats() {
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const response = await api.get('/usage')
        setUsage(response.data)
      } catch (error) {
        console.error('获取用量统计失败:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchUsage()
    // 每30秒刷新一次
    const interval = setInterval(fetchUsage, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return null

  if (!usage) return null

  const { today, history } = usage

  return (
    <div className="usage-stats">
      <div className="usage-item">
        <span className="usage-icon">👥</span>
        <div className="usage-info">
          <span className="usage-value">{today.users}</span>
          <span className="usage-label">今日用户</span>
        </div>
      </div>
      <div className="usage-divider" />
      <div className="usage-item">
        <span className="usage-icon">🤖</span>
        <div className="usage-info">
          <span className="usage-value">{today.calls}</span>
          <span className="usage-label">AI调用</span>
        </div>
      </div>
      <div className="usage-divider" />
      <div className="usage-item">
        <span className="usage-icon">⚡</span>
        <div className="usage-info">
          <span className="usage-value">{today.tokens.toLocaleString()}</span>
          <span className="usage-label">Token消耗</span>
        </div>
      </div>
      {history.length > 0 && (
        <>
          <div className="usage-divider" />
          <div className="usage-item">
            <span className="usage-icon">📅</span>
            <div className="usage-info">
              <span className="usage-value">{history.reduce((s, d) => s + d.tokens, 0).toLocaleString()}</span>
              <span className="usage-label">7日总消耗</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default UsageStats
