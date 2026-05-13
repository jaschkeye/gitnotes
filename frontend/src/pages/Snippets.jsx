import React, { useState, useEffect, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import api from '../api'
import './Snippets.css'

// ============================================================
// 自动语言识别引擎
// ============================================================
function detectLanguage(code) {
  if (!code || code.trim().length < 3) return 'javascript'

  const text = code.trim()

  // HTML 检测（优先级最高，因为HTML经常包含JS/CSS片段）
  const htmlScore = (text.match(/<\/?(div|span|p|h[1-6]|html|head|body|table|form|input|img|a|ul|ol|li|section|header|footer|nav|main|article|class|id)\b/gi) || []).length
  if (htmlScore >= 3) return 'html'
  if (/<!DOCTYPE|<html|<\/html>/i.test(text)) return 'html'

  // CSS 检测
  const cssScore = (text.match(/[\w-]+\s*:\s*[^;]+;/g) || []).length
  if (cssScore >= 3 && /[{}]/.test(text)) return 'css'
  if (/(@media|@import|@keyframes|@font-face)/.test(text)) return 'css'
  if (/^\s*[.#@][\w-]+\s*\{/m.test(text)) return 'css'

  // SQL 检测
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT)\b/i.test(text)) return 'sql'
  if (/\b(SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+.+\s+SET|DELETE\s+FROM)\b/i.test(text)) return 'sql'

  // Python 检测
  if (/^\s*(def |class |import |from \w+ import|if __name__)/m.test(text)) return 'python'
  if (/\b(print|len|range|self\.)\s*\(/.test(text) && !/\bfunction\b/.test(text)) return 'python'
  if (/^\s*(elif|except|raise|yield|lambda|with\s)\b/m.test(text)) return 'python'
  if (/:\s*$/.test(text.split('\n')[0]) && !/function|=>/.test(text)) return 'python'

  // Java 检测
  if (/\b(public|private|protected)\s+(class|interface|enum|void|static)\b/.test(text)) return 'java'
  if (/System\.out\.print/.test(text)) return 'java'
  if (/\b(package\s+[\w.]+;|import\s+java\.)\b/.test(text)) return 'java'

  // C++ 检测
  if (/#\s*include\s*<\w+\.h>/.test(text)) return 'cpp'
  if (/\b(std::|cout\s*<<|cin\s*>>|namespace\s+)\b/.test(text)) return 'cpp'
  if (/\b(int\s+main\s*\(|template\s*<|class\s+\w+\s*\{)/.test(text) && !/function/.test(text)) return 'cpp'

  // JavaScript 检测（默认）
  if (/\b(const|let|var)\s+\w+\s*=/.test(text)) return 'javascript'
  if (/\b(function|=>|require\(|module\.exports)\b/.test(text)) return 'javascript'
  if (/\b(console\.log|document\.|window\.|addEventListener)\b/.test(text)) return 'javascript'
  if (/useState|useEffect|useRef/.test(text)) return 'javascript'

  return 'javascript'
}

function Snippets() {
  const [snippets, setSnippets] = useState([])
  const [selectedSnippet, setSelectedSnippet] = useState(null)
  const [code, setCode] = useState('// 在这里粘贴你的代码...')
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState('auto')
  const [detectedLang, setDetectedLang] = useState('javascript')
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [aiSource, setAiSource] = useState('')
  const [filterLanguage, setFilterLanguage] = useState('all')

  // 代码变化时自动检测语言
  const handleCodeChange = useCallback((value) => {
    const newCode = value || ''
    setCode(newCode)
    if (language === 'auto') {
      const detected = detectLanguage(newCode)
      setDetectedLang(detected)
    }
  }, [language])

  // 切换语言模式时重新检测
  useEffect(() => {
    if (language === 'auto') {
      setDetectedLang(detectLanguage(code))
    }
  }, [language])

  // 获取实际使用的语言（auto时用检测结果，否则用选择的）
  const effectiveLang = language === 'auto' ? detectedLang : language

  useEffect(() => { fetchSnippets() }, [])

  const fetchSnippets = async () => {
    try {
      const params = filterLanguage !== 'all' ? { language: filterLanguage } : {}
      const response = await api.get('/snippets', { params })
      setSnippets(response.data)
    } catch (error) {
      console.error('获取代码片段失败:', error)
    }
  }

  useEffect(() => { fetchSnippets() }, [filterLanguage])

  const handleSave = async () => {
    if (!title.trim()) { setMessage('请输入标题'); return }
    setLoading(true)
    try {
      await api.post('/snippets', { title, language: effectiveLang, code_content: code, tags })
      setMessage('保存成功！')
      setTitle(''); setCode('// 在这里粘贴你的代码...'); setTags([]); setDetectedLang('javascript')
      fetchSnippets()
    } catch (error) { setMessage('保存失败: ' + error.message) }
    finally { setLoading(false) }
  }

  const handleAiTags = async () => {
    if (!code.trim() || code === '// 在这里粘贴你的代码...') { setMessage('请先粘贴代码'); return }
    setLoading(true)
    try {
      const response = await api.post('/ai/tags', { code })
      setTags(response.data.tags)
      const source = response.data.source
      setAiSource(source === 'kimi' ? 'Kimi AI' : '本地引擎')
      setMessage(`AI标签推荐完成（${source === 'kimi' ? 'Kimi AI' : '本地降级'}）`)
    } catch (error) { setMessage('AI标签推荐失败') }
    finally { setLoading(false) }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchMode(false); return }
    if (searchMode) {
      // 语义搜索
      setLoading(true)
      try {
        const response = await api.post('/snippets/semantic-search', { query: searchQuery })
        setSearchResults(response.data)
      } catch (error) { setMessage('搜索失败') }
      finally { setLoading(false) }
    } else {
      // 关键词搜索
      try {
        const response = await api.get('/snippets/search', { params: { q: searchQuery } })
        setSearchResults(response.data)
      } catch (error) { setMessage('搜索失败') }
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('确定要删除这个代码片段吗？')) return
    try {
      await api.delete(`/snippets/${id}`)
      fetchSnippets()
      if (selectedSnippet?.snippet_id === id) setSelectedSnippet(null)
    } catch (error) { setMessage('删除失败') }
  }

  const displayList = searchQuery.trim() ? searchResults : snippets

  return (
    <div className="snippets-page">
      {/* 搜索栏 */}
      <div className="search-bar">
        <div className="search-input-group">
          <input
            type="text"
            placeholder={searchMode ? '用自然语言描述你想找的代码...' : '搜索代码片段...'}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); if (!e.target.value) setSearchResults([]) }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn-search" onClick={handleSearch}>搜索</button>
          <button
            className={`btn-semantic ${searchMode ? 'active' : ''}`}
            onClick={() => setSearchMode(!searchMode)}
            title="AI语义搜索"
          >
            AI搜索
          </button>
        </div>
      </div>

      <div className="snippets-layout">
        {/* 左侧：代码片段列表 */}
        <div className="snippet-list-panel">
          <div className="panel-header">
            <h2>代码片段库</h2>
            <select value={filterLanguage} onChange={(e) => setFilterLanguage(e.target.value)} className="filter-select">
              <option value="all">全部语言</option>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="css">CSS</option>
              <option value="sql">SQL</option>
              <option value="html">HTML</option>
              <option value="cpp">C++</option>
            </select>
          </div>
          <div className="snippet-list">
            {displayList.map(snippet => (
              <div
                key={snippet.snippet_id}
                className={`snippet-item ${selectedSnippet?.snippet_id === snippet.snippet_id ? 'active' : ''}`}
                onClick={() => setSelectedSnippet(snippet)}
              >
                <div className="snippet-item-header">
                  <h3>{snippet.title}</h3>
                  <span className={`lang-badge lang-${snippet.language}`}>{snippet.language}</span>
                </div>
                <div className="snippet-tags">
                  {JSON.parse(snippet.tags || '[]').slice(0, 3).map((tag, idx) => (
                    <span key={idx} className="tag-mini">{tag}</span>
                  ))}
                </div>
                <p className="snippet-date">{new Date(snippet.created_at).toLocaleDateString('zh-CN')}</p>
              </div>
            ))}
            {displayList.length === 0 && (
              <div className="empty-state">暂无代码片段</div>
            )}
          </div>
        </div>

        {/* 右侧：编辑器/详情 */}
        <div className="editor-panel">
          {!selectedSnippet ? (
            /* 新建模式 */
            <div className="editor-new">
              <div className="form-row">
                <input
                  type="text"
                  placeholder="输入代码片段标题..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="title-input"
                />
                <div className="lang-select-group">
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className="lang-select">
                    <option value="auto">自动识别</option>
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                    <option value="html">HTML</option>
                    <option value="css">CSS</option>
                    <option value="sql">SQL</option>
                  </select>
                  {language === 'auto' && (
                    <span className={`lang-badge lang-${detectedLang}`} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', marginLeft: '6px' }}>
                      {detectedLang}
                    </span>
                  )}
                </div>
              </div>

              <div className="editor-wrapper">
                <Editor
                  height="350px"
                  language={effectiveLang}
                  value={code}
                  onChange={handleCodeChange}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: 'on'
                  }}
                />
              </div>

              <div className="editor-actions">
                <div className="tags-area">
                  {tags.map((tag, i) => (
                    <span key={i} className="tag-chip">{tag}
                      <button onClick={() => setTags(tags.filter((_, idx) => idx !== i))} className="tag-remove">×</button>
                    </span>
                  ))}
                  {aiSource && <span className="ai-source-badge">{aiSource}</span>}
                </div>
                <div className="btn-group">
                  <button onClick={handleAiTags} disabled={loading} className="btn btn-ai">
                    {loading ? '分析中...' : 'AI智能标签'}
                  </button>
                  <button onClick={handleSave} disabled={loading} className="btn btn-primary">
                    {loading ? '保存中...' : '保存代码片段'}
                  </button>
                </div>
              </div>

              {message && (
                <div className={`msg ${message.includes('成功') ? 'msg-ok' : 'msg-err'}`}>{message}</div>
              )}
            </div>
          ) : (
            /* 查看模式 */
            <div className="editor-view">
              <div className="view-header">
                <div>
                  <h2>{selectedSnippet.title}</h2>
                  <div className="view-meta">
                    <span className={`lang-badge lang-${selectedSnippet.language}`}>{selectedSnippet.language}</span>
                    <span className="view-date">{new Date(selectedSnippet.created_at).toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="snippet-tags">
                    {JSON.parse(selectedSnippet.tags || '[]').map((tag, idx) => (
                      <span key={idx} className="tag-chip">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="view-actions">
                  <button onClick={() => setSelectedSnippet(null)} className="btn btn-secondary">新建</button>
                  <button onClick={() => handleDelete(selectedSnippet.snippet_id)} className="btn btn-danger">删除</button>
                </div>
              </div>
              <div className="editor-wrapper">
                <Editor
                  height="400px"
                  language={selectedSnippet.language}
                  value={selectedSnippet.code_content}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: 'on'
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Snippets
