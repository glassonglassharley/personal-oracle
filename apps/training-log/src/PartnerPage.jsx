import { useEffect, useMemo, useRef, useState } from 'react'

const API = import.meta.env.VITE_API_URL || ''

const EXERCISE_LABELS = {
  pushups: 'Push-ups', squats: 'Squats', situps: 'Sit-ups',
  pullups: 'Pull-ups', curls: 'Curls', steps: 'Steps', meals: 'Meals', water: 'Water',
}

const EXERCISE_COLORS = {
  pushups: '#4A90D9', squats: '#27AE60', situps: '#E8A020',
  pullups: '#C0392B', curls: '#7B3FA0', bench: '#C25E1A',
  steps: '#6B7280', meals: '#14B8A6', water: '#0ea5e9',
}

const PLAYER_COLORS = [
  '#4A90D9', '#27AE60', '#E8A020', '#C0392B', '#7B3FA0',
  '#C25E1A', '#0ea5e9', '#14B8A6', '#f97316', '#8b5cf6',
]

function getPlayerColor(username) {
  let hash = 0
  for (let i = 0; i < (username || '').length; i++) hash = (hash * 31 + username.charCodeAt(i)) >>> 0
  return PLAYER_COLORS[hash % PLAYER_COLORS.length]
}

function normalizeUsername(value) {
  return String(value || 'athlete').trim().toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'athlete'
}

function extractPartnerFromUrl(raw) {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    return { token: url.searchParams.get('partner') || trimmed, username: url.searchParams.get('user') || '' }
  } catch {
    const [u, t] = trimmed.includes(':') ? trimmed.split(':') : ['', trimmed]
    return { token: t || trimmed, username: t ? u : '' }
  }
}

// ── Compact avatar ────────────────────────────────────────────────────────────

function Avatar({ username, size = 32 }) {
  const color = getPlayerColor(username)
  const initials = (username || '?').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${color}dd, ${color}88)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 900, color: '#fff',
      letterSpacing: '-0.5px', border: `1.5px solid ${color}44`,
    }}>
      {initials}
    </div>
  )
}

// ── Status dot ────────────────────────────────────────────────────────────────

function StatusDot({ trainedToday, hasStreak }) {
  const color = trainedToday ? '#22c55e' : hasStreak ? '#f97316' : '#374151'
  return (
    <div style={{
      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
      background: color,
      boxShadow: trainedToday ? `0 0 5px ${color}, 0 0 10px ${color}66` : 'none',
    }} />
  )
}

// ── Follow button (compact) ───────────────────────────────────────────────────

function FollowBtn({ status, loading, onFollow, onUnfollow, onCancel }) {
  const base = {
    padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
    cursor: 'pointer', flexShrink: 0, opacity: loading ? 0.5 : 1, border: 'none',
  }
  if (status === 'accepted') return (
    <button onClick={onUnfollow} disabled={loading} style={{ ...base, background: 'rgba(255,255,255,0.06)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
      {loading ? '…' : 'Following'}
    </button>
  )
  if (status === 'pending') return (
    <button onClick={onCancel} disabled={loading} style={{ ...base, background: 'rgba(255,255,255,0.04)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
      {loading ? '…' : 'Requested'}
    </button>
  )
  return (
    <button onClick={onFollow} disabled={loading} style={{ ...base, background: 'var(--accent)', color: '#fff' }}>
      {loading ? '…' : 'Follow'}
    </button>
  )
}

// ── Lobby player row (followed / link-added) ──────────────────────────────────

function LobbyPlayerRow({ user, authHeaders, token, onUnfollow, via }) {
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        let res
        if (token) {
          res = await fetch(`${API}/api/social?type=partner&token=${encodeURIComponent(token)}`)
        } else {
          const hdrs = await authHeaders()
          res = await fetch(`${API}/api/social?type=partner&userId=${encodeURIComponent(user.userId)}`, { headers: hdrs })
        }
        if (!res.ok) throw new Error()
        const json = await res.json()
        if (alive) setData(json)
      } catch {
        if (alive) setData(null)
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [user.userId, token])

  const streak      = data?.streak     ?? null
  const dailyTotal  = data?.dailyTotal ?? null
  const today       = data?.today      || {}
  const trainedToday = dailyTotal !== null && dailyTotal > 0
  const hasStreak   = streak !== null && streak > 0
  const exercises   = Object.entries(today).filter(([k]) => !['meals', 'water', 'steps'].includes(k))
  const color       = getPlayerColor(user.username)

  return (
    <>
      {/* ── Compact row ── */}
      <div
        onClick={() => !loading && setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '9px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          cursor: loading ? 'default' : 'pointer',
          transition: 'background 0.15s',
          background: expanded ? 'rgba(255,255,255,0.03)' : 'transparent',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
        onMouseLeave={e => e.currentTarget.style.background = expanded ? 'rgba(255,255,255,0.03)' : 'transparent'}
      >
        <StatusDot trainedToday={trainedToday} hasStreak={hasStreak} />
        <Avatar username={user.username} size={30} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.2px' }}>
            @{user.username}
          </span>
          {via && (
            <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 6, fontWeight: 600 }}>link</span>
          )}
        </div>

        {/* Streak pill */}
        {!loading && hasStreak && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(249,115,22,0.12)', borderRadius: 6, padding: '2px 7px', flexShrink: 0 }}>
            <span style={{ fontSize: 11 }}>🔥</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: '#f97316' }}>{streak}</span>
          </div>
        )}

        {/* Today total */}
        {!loading && dailyTotal !== null && (
          <div style={{ fontSize: 12, fontWeight: 800, color: trainedToday ? '#22c55e' : '#374151', minWidth: 40, textAlign: 'right', flexShrink: 0 }}>
            {trainedToday ? dailyTotal.toLocaleString() : '—'}
          </div>
        )}

        {/* Loading spinner */}
        {loading && (
          <div style={{ width: 14, height: 14, border: '1.5px solid rgba(128,128,128,0.15)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
        )}

        {/* Expand chevron */}
        {!loading && (
          <span style={{ color: 'var(--muted)', fontSize: 11, transform: expanded ? 'rotate(90deg)' : 'none', transition: '0.2s', flexShrink: 0, marginLeft: 2 }}>›</span>
        )}
      </div>

      {/* ── Expanded detail panel ── */}
      {expanded && (
        <div style={{ padding: '10px 12px 12px', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {!data && (
            <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '6px 0' }}>No data shared yet.</div>
          )}

          {data && exercises.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 6, marginBottom: 10 }}>
              {exercises.map(([key, val]) => {
                const reps   = val && typeof val === 'object' ? val?.reps ?? 0 : val
                const c      = EXERCISE_COLORS[key] || '#6B7280'
                return (
                  <div key={key} style={{ background: `${c}12`, border: `1px solid ${c}30`, borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: c, lineHeight: 1 }}>
                      {typeof reps === 'number' ? reps.toLocaleString() : 0}
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                      {EXERCISE_LABELS[key] || key}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {data && (today.steps !== undefined || today.meals !== undefined || today.water !== undefined) && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {today.steps !== undefined && (
                <div style={{ flex: 1, background: 'rgba(107,114,128,0.1)', border: '1px solid rgba(107,114,128,0.2)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#9ca3af' }}>{(today.steps || 0).toLocaleString()}</div>
                  <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>steps</div>
                </div>
              )}
              {today.meals !== undefined && (
                <div style={{ flex: 1, background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.2)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#14B8A6' }}>
                    {Array.isArray(today.meals) ? today.meals.length : today.meals || 0}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>meals</div>
                </div>
              )}
              {today.water !== undefined && (
                <div style={{ flex: 1, background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0ea5e9' }}>{today.water || 0}</div>
                  <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>cups</div>
                </div>
              )}
            </div>
          )}

          {data && exercises.length === 0 && streak === null && dailyTotal === null && (
            <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '4px 0' }}>No activity shared today.</div>
          )}

          <button
            onClick={() => onUnfollow(user.userId || token)}
            style={{
              width: '100%', padding: '6px', background: 'transparent',
              border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8,
              color: 'rgba(239,68,68,0.6)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {via ? 'Remove' : 'Unfollow'}
          </button>
        </div>
      )}
    </>
  )
}

// ── Search result row ─────────────────────────────────────────────────────────

function SearchRow({ result, actionLoading, onFollow, onUnfollow, onCancel }) {
  const loading = !!actionLoading[result.userId]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <Avatar username={result.username} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>@{result.username}</div>
        {result.followerStatus === 'accepted' && (
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>Follows you</div>
        )}
      </div>
      <FollowBtn
        status={result.followStatus}
        loading={loading}
        onFollow={() => onFollow(result.userId)}
        onUnfollow={() => onUnfollow(result.userId)}
        onCancel={() => onCancel(result.userId)}
      />
    </div>
  )
}

// ── Pending request row ───────────────────────────────────────────────────────

function PendingRow({ user, loading, onAccept, onDecline }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <Avatar username={user.username} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>@{user.username}</div>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>Wants to follow you</div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button onClick={() => onDecline(user.userId)} disabled={loading} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
          {loading ? '…' : 'Decline'}
        </button>
        <button onClick={() => onAccept(user.userId)} disabled={loading} style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
          {loading ? '…' : 'Accept'}
        </button>
      </div>
    </div>
  )
}

// ── Collapsible utility section ───────────────────────────────────────────────

function CollapseSection({ label, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 10 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
        <span style={{ fontSize: 14, color: 'var(--muted)', transform: open ? 'rotate(90deg)' : 'none', transition: '0.2s' }}>›</span>
      </button>
      {open && <div style={{ padding: '0 14px 14px' }}>{children}</div>}
    </div>
  )
}

// ── Partner link section ──────────────────────────────────────────────────────

function PartnerLinkSection({ shareToken, myUsername, onGenerate }) {
  const [copied, setCopied] = useState(false)
  const [genLoading, setGen] = useState(false)

  const shareUrl = useMemo(() => {
    if (!shareToken) return null
    const url = new URL(window.location.href)
    url.search = ''; url.hash = ''
    url.searchParams.set('user', myUsername)
    url.searchParams.set('partner', shareToken)
    return url.toString()
  }, [shareToken, myUsername])

  function copy() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  async function generate() {
    setGen(true); await onGenerate(myUsername); setGen(false)
  }

  return (
    <CollapseSection label="Share your link">
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
        Share with anyone who doesn't have an account yet.
      </p>
      {shareToken ? (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {shareUrl}
            </div>
            <button onClick={copy} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: copied ? '#22c55e' : 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 900, cursor: 'pointer', flexShrink: 0 }}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>@{myUsername}</span>
            <button onClick={generate} disabled={genLoading} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', opacity: genLoading ? 0.5 : 1 }}>
              {genLoading ? 'Generating…' : 'New link'}
            </button>
          </div>
        </>
      ) : (
        <button onClick={generate} disabled={genLoading} style={{ width: '100%', padding: 10, borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer', opacity: genLoading ? 0.6 : 1 }}>
          {genLoading ? 'Generating…' : 'Generate partner link'}
        </button>
      )}
    </CollapseSection>
  )
}

// ── Add by link section ───────────────────────────────────────────────────────

function ManualAddSection({ authHeaders, onAdd, onConnected }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function submit() {
    const parsed = extractPartnerFromUrl(input)
    if (!parsed?.token) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${API}/api/social?type=partner&token=${encodeURIComponent(parsed.token)}`)
      if (res.status === 404) { setError('No partner found.'); return }
      if (!res.ok) { setError('Failed to load partner.'); return }
      const data = await res.json()

      // If authenticated and the partner has a userId, create a persistent follow
      // using the token as proof of invitation (auto-accepted on server).
      // On success we skip localStorage — the follow is the connection.
      if (authHeaders && data.userId) {
        try {
          const hdrs = await authHeaders()
          const followRes = await fetch(`${API}/api/social?type=follow`, {
            method: 'POST',
            headers: { ...hdrs, 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetId: data.userId, shareToken: parsed.token }),
          })
          if (followRes.ok) {
            setInput('')
            onConnected?.()
            return
          }
        } catch {}
      }

      // Fallback: store as token-based link partner (unauthenticated or follow failed)
      onAdd({ token: parsed.token, username: data.username || parsed.username || 'partner' })
      setInput('')
    } catch { setError('Network error. Try again.') }
    finally { setLoading(false) }
  }

  return (
    <CollapseSection label="Add by link">
      <div style={{ display: 'flex', gap: 8, marginBottom: error ? 8 : 0 }}>
        <input
          type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Paste partner link or code…"
          style={{ flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, outline: 'none' }}
        />
        <button onClick={submit} disabled={loading || !input.trim()} style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading || !input.trim() ? 0.5 : 1, flexShrink: 0 }}>
          {loading ? '…' : 'Add'}
        </button>
      </div>
      {error && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>{error}</div>}
    </CollapseSection>
  )
}

// ── Main PartnerPage ──────────────────────────────────────────────────────────

export default function PartnerPage({ shareToken, partnerUsername, onGenerateToken, authHeaders, linkPartners = [], onAddLinkPartner, onRemoveLinkPartner }) {
  const myUsername = normalizeUsername(partnerUsername)

  const [query,         setQuery]         = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching,     setSearching]     = useState(false)
  const searchRef = useRef(null)

  const [following,       setFollowing]       = useState([])
  const [pendingReceived, setPendingReceived] = useState([])
  const [pendingSent,     setPendingSent]     = useState([])
  const [followsLoaded,   setFollowsLoaded]   = useState(false)
  const [actionLoading,   setActionLoading]   = useState({})

  useEffect(() => { loadFollows() }, [])

  useEffect(() => {
    const q = query.trim()
    if (!q) { setSearchResults([]); return }
    const t = setTimeout(() => doSearch(q), 180)
    return () => clearTimeout(t)
  }, [query])

  async function loadFollows() {
    try {
      const hdrs = await authHeaders()
      const res  = await fetch(`${API}/api/social?type=follow`, { headers: hdrs })
      if (!res.ok) return
      const json = await res.json()
      setFollowing(json.following || [])
      setPendingReceived(json.pendingReceived || [])
      setPendingSent(json.pendingSent || [])
    } catch {}
    finally { setFollowsLoaded(true) }
  }

  async function doSearch(q) {
    setSearching(true)
    try {
      const hdrs = await authHeaders()
      const res  = await fetch(`${API}/api/users/search?q=${encodeURIComponent(q)}`, { headers: hdrs })
      if (!res.ok) return
      const json = await res.json()
      setSearchResults(json.results || [])
    } catch {}
    finally { setSearching(false) }
  }

  function setLoading(userId, val) {
    setActionLoading(prev => ({ ...prev, [userId]: val }))
  }

  async function sendRequest(targetId) {
    setLoading(targetId, true)
    try {
      const hdrs = await authHeaders()
      await fetch(`${API}/api/social?type=follow`, { method: 'POST', headers: { ...hdrs, 'Content-Type': 'application/json' }, body: JSON.stringify({ targetId }) })
      setSearchResults(prev => prev.map(r => r.userId === targetId ? { ...r, followStatus: 'pending' } : r))
      const target = searchResults.find(r => r.userId === targetId)
      if (target) setPendingSent(prev => [{ userId: targetId, username: target.username }, ...prev.filter(u => u.userId !== targetId)])
    } catch {}
    finally { setLoading(targetId, false) }
  }

  async function cancelRequest(targetId) {
    setLoading(targetId, true)
    try {
      const hdrs = await authHeaders()
      await fetch(`${API}/api/social?type=follow&targetId=${encodeURIComponent(targetId)}`, { method: 'DELETE', headers: hdrs })
      setSearchResults(prev => prev.map(r => r.userId === targetId ? { ...r, followStatus: 'none' } : r))
      setPendingSent(prev => prev.filter(u => u.userId !== targetId))
    } catch {}
    finally { setLoading(targetId, false) }
  }

  async function unfollow(targetId) {
    setLoading(targetId, true)
    try {
      const hdrs = await authHeaders()
      await fetch(`${API}/api/social?type=follow&targetId=${encodeURIComponent(targetId)}`, { method: 'DELETE', headers: hdrs })
      setFollowing(prev => prev.filter(f => f.userId !== targetId))
      setSearchResults(prev => prev.map(r => r.userId === targetId ? { ...r, followStatus: 'none' } : r))
    } catch {}
    finally { setLoading(targetId, false) }
  }

  async function acceptRequest(requesterId) {
    setLoading(requesterId, true)
    try {
      const hdrs = await authHeaders()
      const res = await fetch(`${API}/api/social?type=follow`, { method: 'PUT', headers: { ...hdrs, 'Content-Type': 'application/json' }, body: JSON.stringify({ requesterId, action: 'accept' }) })
      if (res.ok) { setPendingReceived(prev => prev.filter(u => u.userId !== requesterId)); await loadFollows() }
    } catch {}
    finally { setLoading(requesterId, false) }
  }

  async function declineRequest(requesterId) {
    setLoading(requesterId, true)
    try {
      const hdrs = await authHeaders()
      await fetch(`${API}/api/social?type=follow`, { method: 'PUT', headers: { ...hdrs, 'Content-Type': 'application/json' }, body: JSON.stringify({ requesterId, action: 'decline' }) })
      setPendingReceived(prev => prev.filter(u => u.userId !== requesterId))
    } catch {}
    finally { setLoading(requesterId, false) }
  }

  const isSearching = query.trim().length >= 1
  const totalSquad  = following.length + linkPartners.length
  const isEmpty     = followsLoaded && totalSquad === 0 && pendingSent.length === 0 && linkPartners.length === 0 && !isSearching

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 0 32px' }}>

      {/* ── Search bar ── */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '9px 12px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={searchRef} type="text" value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a username…"
            style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 14, outline: 'none' }}
          />
          {query && (
            <button onClick={() => { setQuery(''); setSearchResults([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 17, lineHeight: 1, padding: 0 }}>×</button>
          )}
        </div>

        {isSearching && (
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, overflow: 'hidden', zIndex: 50, boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
            {searching && (
              <div style={{ padding: '14px', textAlign: 'center' }}>
                <div style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(128,128,128,0.15)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              </div>
            )}
            {!searching && searchResults.length === 0 && (
              <div style={{ padding: '14px', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>No athletes found for "{query.trim()}"</div>
            )}
            {!searching && searchResults.length > 0 && (
              <div style={{ padding: '0 14px' }}>
                {searchResults.map(r => (
                  <SearchRow key={r.userId} result={r} actionLoading={actionLoading} onFollow={sendRequest} onUnfollow={unfollow} onCancel={cancelRequest} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Incoming follow requests ── */}
      {followsLoaded && pendingReceived.length > 0 && (
        <div style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.25)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Follow Requests · {pendingReceived.length}
          </div>
          {pendingReceived.map(u => (
            <PendingRow key={u.userId} user={u} loading={!!actionLoading[u.userId]} onAccept={acceptRequest} onDecline={declineRequest} />
          ))}
        </div>
      )}

      {/* ── Squad lobby panel ── */}
      {followsLoaded && totalSquad > 0 && (
        <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
          {/* Lobby header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
              <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: 1 }}>Squad</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{totalSquad} operator{totalSquad !== 1 ? 's' : ''}</span>
          </div>

          {/* Column labels */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ width: 7, flexShrink: 0 }} />
            <div style={{ width: 30, flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Athlete</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Streak</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, minWidth: 40, textAlign: 'right' }}>Today</div>
            <div style={{ width: 16, flexShrink: 0 }} />
          </div>

          {/* Followed players */}
          {following.map(user => (
            <LobbyPlayerRow
              key={user.userId}
              user={user}
              authHeaders={authHeaders}
              onUnfollow={unfollow}
            />
          ))}

          {/* Link-added players */}
          {linkPartners.map(p => (
            <LobbyPlayerRow
              key={p.token}
              user={{ userId: p.token, username: p.username }}
              token={p.token}
              authHeaders={authHeaders}
              onUnfollow={() => onRemoveLinkPartner?.(p.token)}
              via
            />
          ))}
        </div>
      )}

      {/* ── Outgoing pending ── */}
      {followsLoaded && pendingSent.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Requests Sent · {pendingSent.length}
          </div>
          {pendingSent.map(u => (
            <div key={u.userId} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <Avatar username={u.username} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>@{u.username}</span>
                <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 8 }}>pending</span>
              </div>
              <button onClick={() => cancelRequest(u.userId)} disabled={!!actionLoading[u.userId]} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0, opacity: actionLoading[u.userId] ? 0.5 : 1 }}>
                {actionLoading[u.userId] ? '…' : 'Cancel'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Loading ── */}
      {!followsLoaded && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <div style={{ width: 22, height: 22, border: '2px solid rgba(128,128,128,0.15)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      )}

      {/* ── Empty state ── */}
      {isEmpty && (
        <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.7 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎮</div>
          <div style={{ fontWeight: 800, color: 'var(--text)', marginBottom: 4, fontSize: 15 }}>No squad yet</div>
          Share your partner link below, or paste someone's link to connect.
        </div>
      )}

      {/* ── Utility: share link + add by link ── */}
      <div style={{ marginTop: 4 }}>
        <PartnerLinkSection shareToken={shareToken} myUsername={myUsername} onGenerate={onGenerateToken} />
        <ManualAddSection authHeaders={authHeaders} onAdd={p => onAddLinkPartner?.({ token: p.token, username: p.username })} onConnected={loadFollows} />
      </div>
    </div>
  )
}
