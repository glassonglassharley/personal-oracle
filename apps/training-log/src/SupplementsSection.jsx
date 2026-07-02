import { useState } from 'react'

const API = import.meta.env.VITE_API_URL || ''

function fallbackSupplementInfo() {
  return `• Supports general nutrition and wellness when taken consistently
• May enhance results when combined with good sleep, hydration, and training
• Works best as part of a balanced daily routine`
}

async function fetchSupplementInfo(name, authHeaders) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (authHeaders) Object.assign(headers, await authHeaders())
    const res = await fetch(`${API}/api/log`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'generate_supplement_info', name }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || `Supplement info request failed: ${res.status}`)
    const info = String(data.info || '').trim()
    if (!info) throw new Error('Supplement info response was empty')
    if (data.source === 'fallback' && data.debug) {
      console.warn('[supplement] server fell back, reason:', data.debug)
    }
    return { info, source: data.source || 'api', debug: data.debug }
  } catch (err) {
    console.warn('Supplement info generation failed; using local fallback.', err)
    return { info: fallbackSupplementInfo(), source: 'fallback', error: err?.message || 'Generation failed' }
  }
}

function previewText(info) {
  const lines = (info || '').split('\n').filter(l => l.trim() && !/^(BENEFITS|TIMING|DOSAGE|USAGE)/i.test(l))
  return lines.slice(0, 2).join(' · ').slice(0, 80) || '—'
}

// ── Detail / Edit modal ────────────────────────────────────────────────────────

function SupplementDetail({ supp, onSave, onDelete, onClose }) {
  const [text, setText] = useState(supp.info)
  const dirty = text !== supp.info

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'var(--surface)', borderRadius: '22px 22px 0 0',
          maxHeight: '88dvh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>

        <div style={{ padding: '14px 20px 36px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.4px' }}>
                {supp.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                Supplement reference
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--surface2)', color: 'var(--muted)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >×</button>
          </div>

          {/* Editable info */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              Info · tap to edit
            </div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={10}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--surface2)', border: '1.5px solid var(--border)',
                borderRadius: 12, color: 'var(--text)',
                fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6,
                padding: '12px 14px', resize: 'vertical', outline: 'none',
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onSave(text)}
              disabled={!dirty}
              style={{
                flex: 2, padding: '13px', borderRadius: 14,
                background: dirty ? 'var(--accent)' : 'var(--surface2)',
                color: dirty ? '#fff' : 'var(--muted)',
                border: 'none', fontSize: 15, fontWeight: 700, cursor: dirty ? 'pointer' : 'default',
              }}
            >
              {dirty ? 'Save Changes' : 'No Changes'}
            </button>
            <button
              onClick={() => onDelete(supp.id)}
              style={{
                flex: 1, padding: '13px', borderRadius: 14,
                background: 'transparent', color: '#ef4444',
                border: '1.5px solid rgba(239,68,68,0.35)',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Add Sheet ──────────────────────────────────────────────────────────────────

function AddSupplementSheet({ onAdd, onClose, authHeaders }) {
  const [name, setName]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) return
    setLoading(true); setError('')
    const result = await fetchSupplementInfo(trimmed, authHeaders)
    if (result.source === 'fallback' && result.error) {
      setError('AI info could not be reached, so I filled a safe starter card you can edit.')
    }
    onAdd(trimmed, result.info)
    setLoading(false)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 520, padding: '16px 20px 36px', display: 'flex', flexDirection: 'column', gap: 12 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto -4px' }} />
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', textAlign: 'center' }}>Add Supplement</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginTop: -4 }}>
          {authHeaders ? 'Type a name — info card auto-generated for you' : 'Type a name — a starter info card will be added'}
        </div>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && name.trim() && handleSubmit()}
          placeholder="e.g. Creatine, Collagen, B-12…"
          style={{
            background: 'var(--surface2)', border: '1.5px solid var(--border)',
            borderRadius: 12, color: 'var(--text)', fontSize: 15,
            fontFamily: 'inherit', padding: '12px 14px', outline: 'none', width: '100%', boxSizing: 'border-box',
          }}
        />
        {error && <div style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>}
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || loading}
          style={{
            width: '100%', padding: '14px', borderRadius: 14,
            background: 'var(--accent)', color: '#fff', border: 'none',
            fontSize: 15, fontWeight: 700, cursor: (!name.trim() || loading) ? 'default' : 'pointer',
            opacity: (!name.trim() || loading) ? 0.5 : 1,
          }}
        >
          {loading ? 'Generating info…' : 'Add Supplement'}
        </button>
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function SupplementsSection({ supplements = [], onChange, authHeaders }) {
  const [showAdd, setShowAdd]   = useState(false)
  const [openId, setOpenId]     = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const openCard = supplements.find(s => s.id === openId) || null
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredSupplements = normalizedQuery
    ? supplements.filter(s => (String(s.name || '') + ' ' + String(s.info || '')).toLowerCase().includes(normalizedQuery))
    : supplements

  function handleAdd(name, info) {
    const entry = { id: crypto.randomUUID(), name, info, createdAt: Date.now() }
    const next = [...supplements, entry]
    onChange(next)
    setShowAdd(false)
    setOpenId(entry.id)
  }

  function handleSave(id, text) {
    onChange(supplements.map(s => s.id === id ? { ...s, info: text } : s))
    setOpenId(null)
  }

  function handleDelete(id) {
    onChange(supplements.filter(s => s.id !== id))
    setOpenId(null)
  }

  return (
    <div style={{ marginTop: 28 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.3px' }}>Your Supplements</div>
          {supplements.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
              {supplements.length} in your library
            </div>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 10, padding: '8px 14px',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          + Add
        </button>
      </div>

      {supplements.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search supplements"
            aria-label="Search supplements"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--surface)', border: '1.5px solid var(--border)',
              borderRadius: 12, color: 'var(--text)', fontSize: 14,
              fontFamily: 'inherit', padding: '11px 40px 11px 13px', outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear supplement search"
              title="Clear search"
              style={{
                position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
                width: 28, height: 28, borderRadius: 8, border: 'none',
                background: 'var(--surface2)', color: 'var(--muted)',
                fontSize: 17, lineHeight: 1, cursor: 'pointer',
              }}
            >x</button>
          )}
        </div>
      )}

      {/* Card list */}
      {supplements.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          padding: '30px 20px', textAlign: 'center',
          background: 'var(--surface)', border: '1.5px dashed var(--border)', borderRadius: 18,
        }}>
          <span style={{ fontSize: 28 }}>💊</span>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Your supplement library</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, maxWidth: 280 }}>
            Add any supplement or vitamin. We'll generate a quick benefits card for your reference.
          </div>
          <button
            onClick={() => setShowAdd(true)}
            style={{ marginTop: 4, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Add your first supplement
          </button>
        </div>
      ) : filteredSupplements.length === 0 ? (
        <div style={{
          padding: '24px 16px', textAlign: 'center',
          background: 'var(--surface)', border: '1.5px dashed var(--border)', borderRadius: 14,
        }}>
          <div style={{ fontSize: 14, fontWeight: 750, color: 'var(--text)' }}>No supplements found</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Try a different name or keyword.
          </div>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            style={{
              marginTop: 12, padding: '7px 12px', borderRadius: 9,
              border: '1px solid var(--border)', background: 'var(--surface2)',
              color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >Clear search</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredSupplements.map(s => (
            <button
              key={s.id}
              onClick={() => setOpenId(s.id)}
              style={{
                width: '100%', textAlign: 'left',
                background: 'var(--surface)', border: '1.5px solid var(--border)',
                borderRadius: 14, padding: '12px 14px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: 'rgba(108,99,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}>💊</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>
                  {s.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {previewText(s.info)}
                </div>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 16, flexShrink: 0 }}>›</div>
            </button>
          ))}
        </div>
      )}

      {/* Add sheet */}
      {showAdd && <AddSupplementSheet onAdd={handleAdd} onClose={() => setShowAdd(false)} authHeaders={authHeaders} />}

      {/* Detail / edit modal */}
      {openCard && (
        <SupplementDetail
          supp={openCard}
          onSave={text => handleSave(openCard.id, text)}
          onDelete={handleDelete}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}
