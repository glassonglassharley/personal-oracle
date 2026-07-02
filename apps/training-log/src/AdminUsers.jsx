import { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_URL || ''

function fmtDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AdminUsers({ authHeaders }) {
  const [state, setState] = useState({ loading: true, error: '', users: [], currentUserId: null, setup: '' })

  useEffect(() => {
    let cancelled = false
    async function load() {
      setState(s => ({ ...s, loading: true, error: '' }))
      try {
        const headers = await authHeaders()
        const res = await fetch(`${API}/api/users/search?admin=1`, { headers })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setState({
            loading: false,
            error: data.error || `Request failed: ${res.status}`,
            setup: data.setup || '',
            currentUserId: data.currentUserId || null,
            users: [],
          })
          return
        }
        setState({ loading: false, error: '', users: data.users || [], currentUserId: data.currentUserId || null, setup: '' })
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err?.message || 'Unable to load users', users: [], currentUserId: null, setup: '' })
      }
    }
    load()
    return () => { cancelled = true }
  }, [authHeaders])

  const card = {
    background: 'var(--surface)',
    border: '1.5px solid var(--border)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={card}>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Signed-up users</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.45 }}>
          Admin-only view. It shows account identity and activity metadata only — no workouts, meals, photos, sleep, water, or private log contents.
        </div>
      </div>

      {state.loading && (
        <div style={card}>Loading users…</div>
      )}

      {state.error && (
        <div style={{ ...card, borderColor: '#f59e0b66' }}>
          <div style={{ fontWeight: 800, color: '#f59e0b', marginBottom: 8 }}>{state.error}</div>
          {state.currentUserId && (
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.55 }}>
              Your current user ID is:
              <div style={{
                marginTop: 6,
                padding: '8px 10px',
                borderRadius: 10,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                overflowWrap: 'anywhere',
              }}>
                {state.currentUserId}
              </div>
              {state.setup && <div style={{ marginTop: 8 }}>{state.setup}</div>}
            </div>
          )}
        </div>
      )}

      {!state.loading && !state.error && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Users</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{state.users.length}</div>
          </div>
          {state.users.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>No users found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {state.users.map(user => (
                <div key={user.userId} style={{
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: 12,
                  background: user.isYou ? 'var(--accent-dim)' : 'var(--bg)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: 'var(--text)', overflowWrap: 'anywhere' }}>
                        {user.username ? `@${user.username}` : user.maskedUserId}
                        {user.isYou && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>ME</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                        {user.authType} · {user.maskedUserId}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {user.logDays} day{user.logDays === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
                    <div>Joined: <strong style={{ color: 'var(--text)' }}>{fmtDate(user.joinedAt)}</strong></div>
                    <div>Last seen: <strong style={{ color: 'var(--text)' }}>{fmtDate(user.lastSeenAt)}</strong></div>
                    <div>Last log: <strong style={{ color: 'var(--text)' }}>{fmtDate(user.lastLogAt)}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
