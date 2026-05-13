import React, { useState, useEffect } from 'react'
import api from '../api'
import './StudyLogs.css'

function StudyLogs() {
  const [logs, setLogs] = useState([])
  const [selectedLog, setSelectedLog] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', study_hours: 1.0, log_date: new Date().toISOString().split('T')[0] })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { fetchLogs() }, [])

  const fetchLogs = async () => {
    try {
      const response = await api.get('/logs')
      setLogs(response.data)
    } catch (error) { console.error('获取日志失败:', error) }
  }

  const resetForm = () => {
    setForm({ title: '', content: '', study_hours: 1.0, log_date: new Date().toISOString().split('T')[0] })
    setEditing(false)
    setSelectedLog(null)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { setMessage('请输入标题'); return }
    setLoading(true)
    try {
      if (editing && selectedLog) {
        await api.put(`/logs/${selectedLog.log_id}`, form)
        setMessage('更新成功！')
      } else {
        await api.post('/logs', form)
        setMessage('创建成功！')
      }
      resetForm()
      fetchLogs()
    } catch (error) { setMessage('操作失败') }
    finally { setLoading(false) }
  }

  const handleEdit = (log) => {
    setForm({ title: log.title, content: log.content, study_hours: log.study_hours, log_date: log.log_date })
    setSelectedLog(log)
    setEditing(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('确定要删除这篇日志吗？')) return
    try {
      await api.delete(`/logs/${id}`)
      fetchLogs()
      if (selectedLog?.log_id === id) resetForm()
    } catch (error) { setMessage('删除失败') }
  }

  // 简单的Markdown渲染
  const renderMarkdown = (text) => {
    if (!text) return ''
    return text
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n/g, '<br/>')
  }

  const totalHours = logs.reduce((sum, l) => sum + l.study_hours, 0)

  return (
    <div className="logs-page">
      <div className="logs-layout">
        {/* 左侧：日志列表 */}
        <div className="log-list-panel">
          <div className="panel-header">
            <h2>学习日志</h2>
            <span className="log-stats">共 {logs.length} 篇 · {totalHours.toFixed(1)} 小时</span>
          </div>
          <div className="log-list">
            {logs.map(log => (
              <div
                key={log.log_id}
                className={`log-item ${selectedLog?.log_id === log.log_id ? 'active' : ''}`}
                onClick={() => { setSelectedLog(log); setForm({ title: log.title, content: log.content, study_hours: log.study_hours, log_date: log.log_date }); setEditing(false) }}
              >
                <div className="log-item-header">
                  <h3>{log.title}</h3>
                  <span className="log-hours">{log.study_hours}h</span>
                </div>
                <p className="log-date">{log.log_date}</p>
                <p className="log-preview">{log.content.replace(/[#*\-\n]/g, '').substring(0, 60)}...</p>
              </div>
            ))}
            {logs.length === 0 && <div className="empty-state">暂无学习日志</div>}
          </div>
        </div>

        {/* 右侧：编辑器/查看 */}
        <div className="log-editor-panel">
          <div className="log-editor">
            <div className="editor-header">
              <input
                type="text"
                placeholder="日志标题..."
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="log-title-input"
              />
              <div className="editor-meta">
                <label>
                  日期：
                  <input
                    type="date"
                    value={form.log_date}
                    onChange={(e) => setForm({ ...form, log_date: e.target.value })}
                    className="date-input"
                  />
                </label>
                <label>
                  时长：
                  <input
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    value={form.study_hours}
                    onChange={(e) => setForm({ ...form, study_hours: parseFloat(e.target.value) || 0 })}
                    className="hours-input"
                  />
                  小时
                </label>
              </div>
            </div>

            <textarea
              placeholder="用Markdown记录你的学习内容...&#10;&#10;支持语法：&#10;## 二级标题&#10;### 三级标题&#10;**加粗**&#10;- 列表项"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="log-textarea"
            />

            <div className="editor-actions">
              <div className="btn-group">
                <button onClick={handleSave} disabled={loading} className="btn btn-primary">
                  {loading ? '保存中...' : (editing ? '更新日志' : '保存日志')}
                </button>
                {editing && (
                  <button onClick={resetForm} className="btn btn-secondary">取消编辑</button>
                )}
              </div>
              {selectedLog && !editing && (
                <div className="btn-group">
                  <button onClick={() => handleEdit(selectedLog)} className="btn btn-secondary">编辑</button>
                  <button onClick={() => handleDelete(selectedLog.log_id)} className="btn btn-danger">删除</button>
                </div>
              )}
            </div>

            {message && (
              <div className={`msg ${message.includes('成功') ? 'msg-ok' : 'msg-err'}`}>{message}</div>
            )}

            {/* Markdown预览 */}
            {form.content && (
              <div className="markdown-preview">
                <h3 className="preview-title">预览</h3>
                <div
                  className="markdown-body"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(form.content) }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default StudyLogs
