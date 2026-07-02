import { useState, useMemo } from 'react'

const CATEGORIES = ['Fiction', 'Nonfiction', 'Self-Help', 'Biography', 'Sci-Fi', 'History', 'Psychology', 'Other']

function fmtShort(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function BooksBarChart({ finished }) {
  const color = '#8B5CF6'
  const [range, setRange] = useState('1M')

  const buckets = useMemo(() => {
    const now = new Date()
    const withDate = finished.filter(b => b.dateFinished)

    if (range === '1W') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now)
        d.setDate(d.getDate() - (6 - i))
        const dateStr = d.toISOString().slice(0, 10)
        return {
          label: d.toLocaleDateString('en-US', { weekday: 'short' }),
          count: withDate.filter(b => b.dateFinished === dateStr).length,
          key: dateStr,
        }
      })
    }

    if (range === '1M') {
      return Array.from({ length: 4 }, (_, i) => {
        const weekEndDate = new Date(now)
        weekEndDate.setDate(weekEndDate.getDate() - (3 - i) * 7)
        const weekStartDate = new Date(weekEndDate)
        weekStartDate.setDate(weekStartDate.getDate() - 6)
        const s = weekStartDate.toISOString().slice(0, 10)
        const e = weekEndDate.toISOString().slice(0, 10)
        return {
          label: weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          count: withDate.filter(b => b.dateFinished >= s && b.dateFinished <= e).length,
          key: s,
        }
      })
    }

    if (range === '1Y') {
      return Array.from({ length: 12 }, (_, i) => {
        const month = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - (11 - i) + 1, 0)
        const s = month.toISOString().slice(0, 10)
        const e = monthEnd.toISOString().slice(0, 10)
        return {
          label: month.toLocaleDateString('en-US', { month: 'short' }),
          count: withDate.filter(b => b.dateFinished >= s && b.dateFinished <= e).length,
          key: s,
        }
      })
    }

    // 5Y
    return Array.from({ length: 5 }, (_, i) => {
      const year = now.getFullYear() - (4 - i)
      const s = `${year}-01-01`
      const e = `${year}-12-31`
      return {
        label: String(year),
        count: withDate.filter(b => b.dateFinished >= s && b.dateFinished <= e).length,
        key: String(year),
      }
    })
  }, [finished, range])

  const maxCount = Math.max(1, ...buckets.map(b => b.count))
  const totalInRange = buckets.reduce((s, b) => s + b.count, 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          <span style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>{totalInRange}</span>
          {' '}finished
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['1W', '1M', '1Y', '5Y'].map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: '4px 10px', borderRadius: 8, border: 'none',
                background: range === r ? color : 'var(--surface2)',
                color: range === r ? '#fff' : 'var(--muted)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Bars */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 72, paddingBottom: 0 }}>
        {buckets.map(bucket => (
          <div
            key={bucket.key}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%', justifyContent: 'flex-end' }}
          >
            {bucket.count > 0 && (
              <div style={{ fontSize: 9, fontWeight: 800, color }}>{bucket.count}</div>
            )}
            <div style={{
              width: '100%',
              height: `${Math.max(4, (bucket.count / maxCount) * 52)}px`,
              background: bucket.count > 0 ? color : 'var(--border)',
              borderRadius: '3px 3px 0 0',
              transition: 'height 0.25s ease',
              opacity: bucket.count > 0 ? 1 : 0.4,
            }} />
          </div>
        ))}
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', gap: 4, paddingTop: 5 }}>
        {buckets.map(bucket => (
          <div
            key={bucket.key}
            style={{
              flex: 1, textAlign: 'center',
              fontSize: range === '1W' ? 9 : range === '1M' ? 8 : 9,
              color: 'var(--muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {bucket.label}
          </div>
        ))}
      </div>
    </div>
  )
}

const INP = {
  width: '100%', boxSizing: 'border-box', fontSize: 15,
  padding: '10px 12px', borderRadius: 12, border: '1.5px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none',
}
const LBL = {
  fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase',
  letterSpacing: '0.3px', marginBottom: 6, display: 'block',
}

export default function BooksDetail({ booksConfig, onBooksConfigChange, history, dayData, onBack }) {
  const color = '#8B5CF6'
  const books = booksConfig?.books || []
  const reading = books.filter(b => b.status === 'reading')
  const finished = books.filter(b => b.status === 'finished')

  const [catFilter, setCatFilter] = useState('All')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', category: 'Fiction', customCategory: '', format: 'read', status: 'reading', dateFinished: '' })

  const totalSessions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const allDays = [{ date: today, ...dayData }, ...history]
    return allDays.reduce((s, d) => s + (typeof d.books === 'number' ? d.books : 0), 0)
  }, [history, dayData])

  function saveBook() {
    if (!form.title.trim()) return
    const resolvedCategory = form.category === 'Other'
      ? (form.customCategory.trim() || 'Other')
      : form.category
    const newBook = {
      id: Date.now().toString(),
      title: form.title.trim(),
      category: resolvedCategory,
      format: form.format,
      status: form.status,
      dateFinished: form.status === 'finished'
        ? (form.dateFinished || new Date().toISOString().slice(0, 10))
        : null,
    }
    onBooksConfigChange({ ...booksConfig, books: [...books, newBook] })
    setForm({ title: '', category: 'Fiction', customCategory: '', format: 'read', status: 'reading', dateFinished: '' })
    setShowAdd(false)
  }

  function markFinished(id) {
    const today = new Date().toISOString().slice(0, 10)
    onBooksConfigChange({
      ...booksConfig,
      books: books.map(b => b.id === id ? { ...b, status: 'finished', dateFinished: today } : b),
    })
  }

  function deleteBook(id) {
    onBooksConfigChange({ ...booksConfig, books: books.filter(b => b.id !== id) })
  }

  const cats = ['All', ...new Set(finished.map(b => b.category).filter(Boolean))]
  const filteredFinished = catFilter === 'All' ? finished : finished.filter(b => b.category === catFilter)
  const sortedFinished = [...filteredFinished].sort((a, b) => (b.dateFinished || '').localeCompare(a.dateFinished || ''))

  return (
    <div className="exercise-detail">
      <div className="detail-header">
        <button className="detail-back" onClick={onBack}>‹ Back</button>
        <span className="detail-title" style={{ color }}>Books</span>
      </div>

      <div className="detail-hero">
        <div className="dh-num" style={{ color }}>{finished.length}</div>
        <div className="dh-label">books finished</div>
        {totalSessions > 0 && (
          <div className="dh-sub">{totalSessions} total reading sessions logged</div>
        )}
      </div>

      {/* Books Chart */}
      <div className="detail-section">
        <h3 className="detail-sec-hd" style={{ marginBottom: 16 }}>History</h3>
        <BooksBarChart finished={finished} />
      </div>

      {/* Add Book */}
      <div className="detail-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showAdd ? 14 : 0 }}>
          <h3 className="detail-sec-hd" style={{ margin: 0 }}>Add Book</h3>
          <button
            onClick={() => setShowAdd(s => !s)}
            style={{ padding: '6px 14px', borderRadius: 10, border: `1.5px solid var(--border)`, background: showAdd ? `${color}20` : 'transparent', color: showAdd ? color : 'var(--muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            {showAdd ? '✕ Cancel' : '+ Add'}
          </button>
        </div>

        {showAdd && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            <div>
              <span style={LBL}>Title</span>
              <input
                style={INP} type="text" placeholder="Book title…"
                value={form.title} autoFocus
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && saveBook()}
              />
            </div>
            <div>
              <span style={LBL}>Category</span>
              <select
                style={{ ...INP, appearance: 'none' }}
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value, customCategory: '' }))}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {form.category === 'Other' && (
                <input
                  style={{ ...INP, marginTop: 8 }}
                  type="text"
                  placeholder="Enter custom category…"
                  value={form.customCategory}
                  onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))}
                />
              )}
            </div>
            <div>
              <span style={LBL}>Format</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ value: 'read', label: '📖 Read' }, { value: 'audiobook', label: '🎧 Audiobook' }].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setForm(f => ({ ...f, format: value }))}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid var(--border)', background: form.format === value ? `${color}20` : 'transparent', color: form.format === value ? color : 'var(--muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span style={LBL}>Status</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {['reading', 'finished'].map(s => (
                  <button
                    key={s}
                    onClick={() => setForm(f => ({ ...f, status: s }))}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid var(--border)', background: form.status === s ? `${color}20` : 'transparent', color: form.status === s ? color : 'var(--muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {form.status === 'finished' && (
              <div>
                <span style={LBL}>Date Finished</span>
                <input
                  style={INP} type="date"
                  value={form.dateFinished}
                  onChange={e => setForm(f => ({ ...f, dateFinished: e.target.value }))}
                />
              </div>
            )}
            <button
              onClick={saveBook}
              disabled={!form.title.trim()}
              style={{ padding: '14px', background: color, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: form.title.trim() ? 'pointer' : 'default', opacity: form.title.trim() ? 1 : 0.5 }}
            >
              Save Book
            </button>
          </div>
        )}
      </div>

      {/* Currently Reading */}
      {reading.length > 0 && (
        <div className="detail-section">
          <h3 className="detail-sec-hd">Currently Reading</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reading.map(book => (
              <div key={book.id} style={{ background: 'var(--surface)', borderRadius: 12, padding: '12px 14px', border: '1.5px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 2 }}>{book.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {[book.category, book.format === 'audiobook' ? '🎧 Audiobook' : book.format === 'read' ? '📖 Read' : null].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => markFinished(book.id)}
                      style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #22c55e40', background: '#22c55e20', color: '#22c55e', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      ✓ Done
                    </button>
                    <button
                      onClick={() => deleteBook(book.id)}
                      style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #ef444440', background: '#ef444420', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {reading.length === 0 && !showAdd && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '0 0 12px' }}>
          No book currently set — tap + Add above
        </div>
      )}

      {/* Finished Books */}
      {finished.length > 0 && (
        <div className="detail-section">
          <h3 className="detail-sec-hd">
            Finished
            <span className="detail-sec-sub">{finished.length} book{finished.length !== 1 ? 's' : ''}</span>
          </h3>

          {cats.length > 1 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {cats.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCatFilter(cat)}
                  style={{ padding: '4px 10px', borderRadius: 20, border: '1.5px solid var(--border)', background: catFilter === cat ? `${color}20` : 'transparent', color: catFilter === cat ? color : 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedFinished.map(book => (
              <div key={book.id} style={{ background: 'var(--surface)', borderRadius: 12, padding: '12px 14px', border: '1.5px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 2 }}>{book.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {[book.category, book.format === 'audiobook' ? '🎧 Audiobook' : book.format === 'read' ? '📖 Read' : null, fmtShort(book.dateFinished)].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteBook(book.id)}
                    style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #ef444440', background: '#ef444420', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
