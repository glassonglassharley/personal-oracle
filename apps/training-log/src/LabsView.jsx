import { useState, useRef, useEffect, useId } from 'react'

const API = import.meta.env.VITE_API_URL || ''
const MAX_FILE_BYTES = 15 * 1024 * 1024

const FLAG_COLOR = { critical: '#ef4444', high: '#f59e0b', low: '#f59e0b', normal: '#22c55e' }
const FLAG_LABEL = { critical: 'Critical', high: 'High', low: 'Low', normal: 'Normal' }

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function compressLabImage(file, maxW = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')) }
    img.src = url
  })
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

const cardStyle = {
  background: 'var(--surface)', borderRadius: 16, padding: '16px',
  marginBottom: 12, border: '1.5px solid var(--border)',
}
const labelStyle = {
  fontSize: 11, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6,
}
const fieldInputStyle = {
  width: '100%', boxSizing: 'border-box', fontSize: 14,
  padding: '6px 8px', borderRadius: 8,
  border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)',
}

// ── Marker history sparkline (mirrors the WeightSection inline chart) ──────

function MarkerSparkline({ points }) {
  const gradId = useId().replace(/:/g, '')
  if (!points || points.length < 2) return null

  const W = 340, H = 70, pL = 4, pR = 4, pT = 10, pB = 4
  const iW = W - pL - pR, iH = H - pT - pB
  const vals = points.map(p => p.value)
  const minV = Math.min(...vals) * 0.98
  const maxV = Math.max(...vals) * 1.02
  const range = (maxV - minV) || 1
  const cx = i => pL + (points.length > 1 ? (i / (points.length - 1)) * iW : iW / 2)
  const cy = v => pT + iH - ((v - minV) / range) * iH
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${cx(i).toFixed(1)},${cy(p.value).toFixed(1)}`).join(' ')
  const area = `${line} L${cx(points.length - 1).toFixed(1)},${pT + iH} L${cx(0).toFixed(1)},${pT + iH} Z`

  return (
    <div style={{ marginTop: 8 }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={cx(points.length - 1)} cy={cy(vals[vals.length - 1])} r={3.5} fill="#22c55e" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
        <span>{fmtDate(points[0].date)}</span>
        <span>{fmtDate(points[points.length - 1].date)}</span>
      </div>
    </div>
  )
}

// ── Single marker row, with inline correction ───────────────────────────────

function MarkerRow({ marker, history, authHeaders, onUpdated }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)

  function startEdit() {
    setDraft({
      value: marker.value ?? '',
      unit: marker.unit ?? '',
      reference_range_low: marker.reference_range_low ?? '',
      reference_range_high: marker.reference_range_high ?? '',
      flag: marker.flag || 'normal',
    })
    setEditing(true)
  }

  async function save() {
    setSaving(true)
    try {
      const hdrs = await authHeaders()
      const res = await fetch(`${API}/api/health-metrics?metric=labs&action=update_marker`, {
        method: 'POST',
        headers: { ...hdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ marker_id: marker.id, ...draft }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.marker) onUpdated(json.marker)
    } catch {}
    setSaving(false)
    setEditing(false)
  }

  const color = FLAG_COLOR[marker.flag] || 'var(--muted)'

  return (
    <div style={{
      padding: '12px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{marker.marker_name}</div>
          {marker.ai_note && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, lineHeight: 1.4 }}>{marker.ai_note}</div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color }}>
            {marker.value != null ? marker.value : '—'} {marker.unit || ''}
          </div>
          <div style={{
            fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase',
            letterSpacing: '0.4px', marginTop: 2,
          }}>
            {FLAG_LABEL[marker.flag] || marker.flag}
          </div>
          {(marker.reference_range_low != null || marker.reference_range_high != null) && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              ref {marker.reference_range_low ?? '?'}–{marker.reference_range_high ?? '?'}
            </div>
          )}
        </div>
      </div>

      {!editing ? (
        <button
          onClick={startEdit}
          style={{
            marginTop: 8, background: 'none', border: 'none', color: 'var(--accent)',
            fontSize: 12, fontWeight: 700, padding: 0, cursor: 'pointer',
          }}
        >
          Correct value
        </button>
      ) : (
        <div style={{ marginTop: 10, background: 'var(--surface2)', borderRadius: 10, padding: 10 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Value</div>
              <input
                type="number" inputMode="decimal" autoFocus
                value={draft.value}
                onChange={e => setDraft({ ...draft, value: e.target.value })}
                onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }}
                style={fieldInputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Unit</div>
              <input
                type="text" value={draft.unit}
                onChange={e => setDraft({ ...draft, unit: e.target.value })}
                onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }}
                style={fieldInputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Range low</div>
              <input
                type="number" inputMode="decimal"
                value={draft.reference_range_low}
                onChange={e => setDraft({ ...draft, reference_range_low: e.target.value })}
                onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }}
                style={fieldInputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Range high</div>
              <input
                type="number" inputMode="decimal"
                value={draft.reference_range_high}
                onChange={e => setDraft({ ...draft, reference_range_high: e.target.value })}
                onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }}
                style={fieldInputStyle}
              />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={labelStyle}>Flag</div>
            <select
              value={draft.flag}
              onChange={e => setDraft({ ...draft, flag: e.target.value })}
              style={fieldInputStyle}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={save} disabled={saving}
              className="btn-primary"
              style={{ flex: 1, padding: '7px 0', fontSize: 13 }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{
                flex: 1, padding: '7px 0', fontSize: 13, borderRadius: 8,
                border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {history && <MarkerSparkline points={history} />}
    </div>
  )
}

// ── Panel detail (full marker table) ────────────────────────────────────────

function LabPanelDetail({ panelId, authHeaders, onBack }) {
  const [panel, setPanel] = useState(null)
  const [markers, setMarkers] = useState([])
  const [history, setHistory] = useState({})
  const [loading, setLoading] = useState(true)
  const [editingDate, setEditingDate] = useState(false)
  const [dateVal, setDateVal] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const hdrs = await authHeaders()
        const res = await fetch(`${API}/api/health-metrics?metric=labs&action=get&id=${panelId}`, { headers: hdrs })
        const json = await res.json()
        if (cancelled) return
        setPanel(json.panel)
        setMarkers(json.markers || [])
        setDateVal(json.panel?.panel_date || '')

        const names = [...new Set((json.markers || []).map(m => m.marker_name))]
        if (names.length) {
          const hRes = await fetch(`${API}/api/health-metrics?metric=labs&action=marker_history`, {
            method: 'POST',
            headers: { ...hdrs, 'Content-Type': 'application/json' },
            body: JSON.stringify({ names }),
          })
          const hJson = await hRes.json().catch(() => ({ history: {} }))
          if (!cancelled) setHistory(hJson.history || {})
        }
      } catch {}
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [panelId])

  async function saveDate() {
    setEditingDate(false)
    if (!dateVal || dateVal === panel?.panel_date) return
    try {
      const hdrs = await authHeaders()
      const res = await fetch(`${API}/api/health-metrics?metric=labs&action=update_panel_date`, {
        method: 'POST',
        headers: { ...hdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ panel_id: panelId, panel_date: dateVal }),
      })
      if (res.ok) setPanel(p => ({ ...p, panel_date: dateVal }))
    } catch {}
  }

  function updateMarker(updated) {
    setMarkers(prev => prev.map(m => m.id === updated.id ? updated : m))
  }

  const flaggedCount = markers.filter(m => m.flag !== 'normal').length
  const normalCount = markers.length - flaggedCount

  return (
    <div>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 14, fontWeight: 700, padding: 0, marginBottom: 12, cursor: 'pointer' }}
      >
        ← Back to Labs
      </button>

      {loading ? (
        <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--muted)' }}>Loading panel…</div>
      ) : !panel ? (
        <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--muted)' }}>Panel not found.</div>
      ) : (
        <>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {!editingDate ? (
                  <div
                    onClick={() => setEditingDate(true)}
                    style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', cursor: 'pointer' }}
                  >
                    {fmtDate(panel.panel_date)}
                  </div>
                ) : (
                  <input
                    type="date" autoFocus value={dateVal}
                    onChange={e => setDateVal(e.target.value)}
                    onBlur={saveDate}
                    onKeyDown={e => { if (e.key === 'Enter') saveDate(); if (e.key === 'Escape') setEditingDate(false) }}
                    style={{ ...fieldInputStyle, width: 160 }}
                  />
                )}
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  {flaggedCount} flagged, {normalCount} normal
                </div>
              </div>
              {panel.source_file_url && (
                <a href={panel.source_file_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>
                  View file
                </a>
              )}
            </div>
          </div>

          <div style={cardStyle}>
            {markers.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>
                No markers extracted from this panel.
              </div>
            ) : (
              markers.map(m => (
                <MarkerRow
                  key={m.id}
                  marker={m}
                  history={history[m.marker_name]}
                  authHeaders={authHeaders}
                  onUpdated={updateMarker}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Panel list card ──────────────────────────────────────────────────────

function LabPanelCard({ panel, onClick }) {
  const isImage = panel.source_file_url && /\.(jpg|jpeg|png)$/i.test(panel.source_file_url)
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--surface)', border: '1.5px solid var(--border)',
        borderRadius: 14, padding: 12, marginBottom: 8, cursor: 'pointer',
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', fontSize: 20,
      }}>
        {isImage ? (
          <img src={panel.source_file_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : '📄'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{fmtDate(panel.panel_date)}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
          {panel.flagged_count > 0 ? `${panel.flagged_count} flagged, ` : ''}{panel.normal_count} normal
        </div>
      </div>
      <span style={{ color: 'var(--muted)', fontSize: 16 }}>›</span>
    </div>
  )
}

// ── Top-level Labs tab ───────────────────────────────────────────────────

export default function LabsView({ authHeaders }) {
  const [panels, setPanels] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedPanelId, setSelectedPanelId] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!authHeaders) { setLoaded(true); return }
      try {
        const hdrs = await authHeaders()
        const res = await fetch(`${API}/api/health-metrics?metric=labs&action=list`, { headers: hdrs })
        if (!res.ok) throw new Error()
        const json = await res.json()
        if (!cancelled) setPanels(json.panels || [])
      } catch {
        if (!cancelled) setError('Could not load lab panels.')
      }
      if (!cancelled) setLoaded(true)
    }
    load()
    return () => { cancelled = true }
  }, [authHeaders])

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)

    const isPdf = file.type === 'application/pdf'
    if (!isPdf && !file.type.startsWith('image/')) {
      setError('Please choose a PDF or image file.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('File is too large — please choose a file under 15MB.')
      return
    }

    setUploading(true)
    try {
      const dataUrl = isPdf ? await readFileAsDataUrl(file) : await compressLabImage(file)
      const mimeType = isPdf ? 'application/pdf' : 'image/jpeg'
      const hdrs = await authHeaders()
      const res = await fetch(`${API}/api/health-metrics?metric=labs&action=upload`, {
        method: 'POST',
        headers: { ...hdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, mimeType, panel_date: todayStr() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`)

      const flagged = (json.markers || []).filter(m => m.flag !== 'normal').length
      const normal = (json.markers || []).length - flagged
      setPanels(prev => [{
        id: json.panel.id, panel_date: json.panel.panel_date, uploaded_at: json.panel.uploaded_at,
        source_file_url: json.panel.source_file_url, flagged_count: flagged, normal_count: normal,
      }, ...prev])
      setSelectedPanelId(json.panel.id)
    } catch (err) {
      setError(err.message || 'Upload failed')
    }
    setUploading(false)
  }

  if (!authHeaders) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--muted)' }}>
        Sign in to use Labs.
      </div>
    )
  }

  if (selectedPanelId != null) {
    return (
      <LabPanelDetail
        panelId={selectedPanelId}
        authHeaders={authHeaders}
        onBack={() => setSelectedPanelId(null)}
      />
    )
  }

  return (
    <div style={{ paddingBottom: 16 }}>
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
          Labs
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="btn-primary"
          style={{ width: '100%', padding: '10px 0', fontSize: 14 }}
        >
          {uploading ? 'Analyzing lab panel…' : '+ Upload Lab Result'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        {error && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#ef4444' }}>{error}</div>
        )}
      </div>

      {!loaded ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>Loading…</div>
      ) : panels.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>
          No lab panels yet. Upload a PDF or photo of your results to get started.
        </div>
      ) : (
        panels.map(p => (
          <LabPanelCard key={p.id} panel={p} onClick={() => setSelectedPanelId(p.id)} />
        ))
      )}
    </div>
  )
}
