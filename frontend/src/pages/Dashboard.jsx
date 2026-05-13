import React, { useState, useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import api from '../api'
import './Dashboard.css'

function Dashboard() {
  const [stats, setStats] = useState(null)
  const langPieRef = useRef(null)
  const dailyBarRef = useRef(null)
  const heatmapRef = useRef(null)
  const tagsBarRef = useRef(null)
  const langRadarRef = useRef(null)

  useEffect(() => {
    fetchStats()
  }, [])

  useEffect(() => {
    if (!stats) return

    // 语言分布饼图
    if (langPieRef.current) {
      const chart = echarts.init(langPieRef.current)
      chart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c}个 ({d}%)' },
        legend: { bottom: 0, textStyle: { color: 'rgba(255,255,255,0.6)', fontSize: 12 } },
        series: [{
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 8, borderColor: '#1a1a2e', borderWidth: 3 },
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 14, fontWeight: 'bold', color: '#fff' },
            itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' }
          },
          data: stats.languageDistribution,
          color: ['#667eea', '#f5576c', '#4facfe', '#22c55e', '#f7df1e', '#e34c26', '#764ba2', '#f093fb']
        }]
      })
      window.addEventListener('resize', () => chart.resize())
    }

    // 每日学习时长柱状图
    if (dailyBarRef.current) {
      const chart = echarts.init(dailyBarRef.current)
      chart.setOption({
        tooltip: { trigger: 'axis', formatter: '{b}<br/>学习 {c} 小时' },
        grid: { left: 40, right: 20, top: 20, bottom: 30 },
        xAxis: {
          type: 'category',
          data: stats.dailyStudy.map(d => d.date.substring(5)),
          axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, rotate: 45 },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
        },
        yAxis: {
          type: 'value',
          name: '小时',
          nameTextStyle: { color: 'rgba(255,255,255,0.5)' },
          axisLabel: { color: 'rgba(255,255,255,0.5)' },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }
        },
        series: [{
          type: 'bar',
          data: stats.dailyStudy.map(d => d.hours),
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#4facfe' },
              { offset: 1, color: '#00f2fe' }
            ])
          },
          barMaxWidth: 30
        }]
      })
      window.addEventListener('resize', () => chart.resize())
    }

    // 活跃热力图
    if (heatmapRef.current) {
      const chart = echarts.init(heatmapRef.current)
      const data = stats.heatmap.map(d => [d.date, d.count, d.level])
      const maxDate = stats.heatmap[stats.heatmap.length - 1]?.date || ''
      const minDate = stats.heatmap[0]?.date || ''

      chart.setOption({
        tooltip: {
          formatter: (p) => `${p.data[0]}<br/>活跃度: ${p.data[1]}次`
        },
        grid: { left: 50, right: 20, top: 10, bottom: 30 },
        xAxis: {
          type: 'category',
          data: [...new Set(stats.heatmap.map(d => d.date.substring(0, 7)))],
          axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          splitArea: { show: true, areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'] } }
        },
        yAxis: {
          type: 'category',
          data: ['日', '六', '五', '四', '三', '二', '一'],
          axisLabel: { color: 'rgba(255,255,255,0.5)' },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
        },
        visualMap: {
          min: 0, max: 4, show: false,
          inRange: {
            color: ['rgba(255,255,255,0.04)', 'rgba(102,126,234,0.3)', 'rgba(102,126,234,0.5)', 'rgba(102,126,234,0.7)', 'rgba(102,126,234,0.95)']
          }
        },
        series: [{
          type: 'scatter',
          symbolSize: 18,
          data: stats.heatmap.map(d => {
            const dayOfWeek = new Date(d.date).getDay()
            return [d.date.substring(0, 7), 6 - dayOfWeek, d.count]
          }),
          itemStyle: {
            borderRadius: 4,
            color: (params) => {
              const colors = ['rgba(255,255,255,0.04)', 'rgba(102,126,234,0.3)', 'rgba(102,126,234,0.5)', 'rgba(102,126,234,0.7)', 'rgba(102,126,234,0.95)']
              const level = params.data[2] === 0 ? 0 : params.data[2] <= 1 ? 1 : params.data[2] <= 2 ? 2 : params.data[2] <= 3 ? 3 : 4
              return colors[level]
            }
          }
        }]
      })
      window.addEventListener('resize', () => chart.resize())
    }

    // 标签TOP10柱状图
    if (tagsBarRef.current) {
      const chart = echarts.init(tagsBarRef.current)
      chart.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: 80, right: 20, top: 10, bottom: 20 },
        xAxis: {
          type: 'value',
          axisLabel: { color: 'rgba(255,255,255,0.5)' },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }
        },
        yAxis: {
          type: 'category',
          data: stats.topTags.map(t => t.name).reverse(),
          axisLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
        },
        series: [{
          type: 'bar',
          data: stats.topTags.map(t => t.value).reverse(),
          itemStyle: {
            borderRadius: [0, 6, 6, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#667eea' },
              { offset: 1, color: '#764ba2' }
            ])
          },
          barMaxWidth: 20
        }]
      })
      window.addEventListener('resize', () => chart.resize())
    }

    // 语言学习时长雷达图
    if (langRadarRef.current && stats.languageHours.length > 0) {
      const chart = echarts.init(langRadarRef.current)
      const indicators = stats.languageHours.map(l => ({ name: l.name, max: Math.max(...stats.languageHours.map(x => x.value)) * 1.2 }))
      chart.setOption({
        tooltip: {},
        radar: {
          indicator: indicators,
          axisName: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
          splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'] } },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
        },
        series: [{
          type: 'radar',
          data: [{
            value: stats.languageHours.map(l => l.value),
            name: '学习时长',
            areaStyle: { color: 'rgba(102,126,234,0.2)' },
            lineStyle: { color: '#667eea', width: 2 },
            itemStyle: { color: '#667eea' }
          }]
        }]
      })
      window.addEventListener('resize', () => chart.resize())
    }
  }, [stats])

  const fetchStats = async () => {
    try {
      const response = await api.get('/stats')
      setStats(response.data)
    } catch (error) { console.error('获取统计数据失败:', error) }
  }

  if (!stats) return <div className="loading">加载数据中...</div>

  const { overview } = stats

  return (
    <div className="dashboard-page">
      {/* 总览卡片 */}
      <div className="overview-cards">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
            <span>📝</span>
          </div>
          <div className="stat-info">
            <p className="stat-value">{overview.totalSnippets}</p>
            <p className="stat-label">代码片段</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
            <span>📖</span>
          </div>
          <div className="stat-info">
            <p className="stat-value">{overview.totalLogs}</p>
            <p className="stat-label">学习日志</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f093fb, #f5576c)' }}>
            <span>⏱️</span>
          </div>
          <div className="stat-info">
            <p className="stat-value">{overview.totalHours}h</p>
            <p className="stat-label">学习时长</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #4facfe, #00f2fe)' }}>
            <span>🏷️</span>
          </div>
          <div className="stat-info">
            <p className="stat-value">{overview.totalTags}</p>
            <p className="stat-label">标签总数</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f7df1e, #f0a500)' }}>
            <span>🔥</span>
          </div>
          <div className="stat-info">
            <p className="stat-value">{overview.activeDays}</p>
            <p className="stat-label">活跃天数</p>
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3>语言分布</h3>
          <div ref={langPieRef} className="chart-container" />
        </div>
        <div className="chart-card">
          <h3>近14天学习时长</h3>
          <div ref={dailyBarRef} className="chart-container" />
        </div>
        <div className="chart-card chart-wide">
          <h3>活跃热力图（近12周）</h3>
          <div ref={heatmapRef} className="chart-container" />
        </div>
        <div className="chart-card">
          <h3>热门标签 TOP10</h3>
          <div ref={tagsBarRef} className="chart-container" />
        </div>
        <div className="chart-card">
          <h3>各语言学习时长</h3>
          <div ref={langRadarRef} className="chart-container" />
        </div>
      </div>
    </div>
  )
}

export default Dashboard
