import { useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { HealthBridge } from '../lib/health.js'

const API              = import.meta.env.VITE_API_URL || ''
const DEFAULT_GOAL     = 8

function clamp(value) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.min(24, Math.round(n * 4) / 4)) : 0
}

function fmt(value) {
  const n = clamp(value)
  if (!n) return '0'
  return Number.isInteger(n) ? `${n}h` : `${n.toFixed(1)}h`
}

function quality(hours, goal = DEFAULT_GOAL) {
  if (!hours) return { label: 'Not logged', color: 'var(--muted)' }
  if (hours >= goal)     return { label: 'Recovered',     color: '#8b5cf6' }
  if (hours >= goal - 1) return { label: 'Close to goal', color: '#38bdf8' }
  if (hours >= 5)        return { label: 'Light sleep',   color: '#f59e0b' }
  return                        { label: 'Low sleep',     color: '#ef4444' }
}

// ── Source badge ──────────────────────────────────────────────────────────────

function SourceBadge({ source, syncing, onSync }) {
  const colorMap = {
    'Oura':           '#7c3aed',
    'Google Fit':     '#4285F4',
    'Health Connect': '#ff2d55',
    'HealthKit':      '#ff2d55',
  }
  const color = colorMap[source] || 'var(--muted)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        fontSize: 9, fontWeight: 800, color, textTransform: 'uppercase',
        letterSpacing: '0.6px', background: `${color}18`,
        border: `1px solid ${color}40`, borderRadius: 6,
        padding: '2px 7px',
      }}>
        {source}
      </div>
      <button
        onClick={onSync}
        disabled={syncing}
        style={{
          background: 'none', border: 'none', cursor: syncing ? 'default' : 'pointer',
          padding: '2px 4px', borderRadius: 6, opacity: syncing ? 0.5 : 0.8,
          display: 'flex', alignItems: 'center',
        }}
        title="Sync now"
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ animation: syncing ? 'spin 0.7s linear infinite' : 'none' }}
        >
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      </button>
    </div>
  )
}

// ── Stage pills ───────────────────────────────────────────────────────────────

function StagePills({ deepMin, remMin, lightMin, awakeMin }) {
  const pills = [
    { label: 'Deep',  val: deepMin,  color: '#7c3aed' },
    { label: 'REM',   val: remMin,   color: '#38bdf8' },
    { label: 'Light', val: lightMin, color: '#8b5cf6' },
    { label: 'Awake', val: awakeMin, color: '#6b7280' },
  ].filter(p => p.val != null && p.val > 0)

  if (!pills.length) return null
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
      {pills.map(p => (
        <div key={p.label} style={{
          fontSize: 10, fontWeight: 800, color: p.color,
          background: `${p.color}14`, border: `1px solid ${p.color}30`,
          borderRadius: 8, padding: '3px 8px',
        }}>
          {p.label} {p.val}m
        </div>
      ))}
    </div>
  )
}

// ── Score badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score, hrv }) {
  if (!score && !hrv) return null
  const scoreColor = score >= 85 ? '#22c55e' : score >= 70 ? '#8b5cf6' : score >= 55 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      {score != null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: `${scoreColor}12`, border: `1px solid ${scoreColor}30`,
          borderRadius: 10, padding: '5px 10px',
        }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: scoreColor, letterSpacing: '-0.5px' }}>{score}</span>
          <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Score</span>
        </div>
      )}
      {hrv != null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
          borderRadius: 10, padding: '5px 10px',
        }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: '#8b5cf6', letterSpacing: '-0.5px' }}>{hrv}</span>
          <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>HRV ms</span>
        </div>
      )}
    </div>
  )
}

// ── Quick button style ────────────────────────────────────────────────────────

const quickBtn = {
  background: 'var(--surface2)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 10,
  padding: '8px 4px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
}

// ── SleepTracker ──────────────────────────────────────────────────────────────

export default function SleepTracker({
  sleepHours     = 0,
  sleepLog       = [],
  goal           = DEFAULT_GOAL,
  history        = [],
  onChange,
  onClear,
  authHeaders,
  ouraPAT,
  onSaveOuraPAT,
  compact        = false,
}) {
  const [draft,            setDraft]            = useState(() => sleepHours ? String(sleepHours) : '')
  const [external,         setExternal]         = useState(null)
  const [syncing,          setSyncing]          = useState(false)
  const [syncDone,         setSyncDone]         = useState(false)
  const [connectOpen,      setConnectOpen]      = useState(false)
  const [ouraInput,        setOuraInput]        = useState('')
  const [connectingGoogle, setConnectingGoogle] = useState(false)
  const mountedRef = useRef(true)

  const hours = clamp(sleepHours)
  const pct   = goal > 0 ? Math.min(100, Math.round((hours / goal) * 100)) : 0
  const qual  = quality(hours, goal)
  const recentSleepSession = Array.isArray(sleepLog) && sleepLog.length
    ? sleepLog[sleepLog.length - 1]
    : null

  useEffect(() => {
    mountedRef.current = true
    syncSleep()
    return () => { mountedRef.current = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-sync when Oura PAT is newly provided
  useEffect(() => {
    if (ouraPAT && !external) {
      setSyncDone(false)
      syncSleep(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouraPAT])

  // Keep draft in sync when sleepHours prop changes (e.g. from external auto-fill)
  useEffect(() => {
    setDraft(sleepHours ? String(sleepHours) : '')
  }, [sleepHours])

  async function syncSleep(force = false) {
    if (syncing || (!force && syncDone) || !authHeaders) return
    setSyncing(true)
    try {
      // ── 1. Native: Health Connect / HealthKit ─────────────────────────────
      if (Capacitor.isNativePlatform()) {
        const nativeHours = await HealthBridge.getLastNightSleep().catch(() => 0)
        if (nativeHours > 0 && mountedRef.current) {
          const src = Capacitor.getPlatform() === 'ios' ? 'HealthKit' : 'Health Connect'
          setExternal({ hours: nativeHours, source: src })
          if (!sleepHours) onChange?.(nativeHours)
          return
        }
      }

      // ── 2. Oura (richest data, if PAT configured) ─────────────────────────
      if (ouraPAT) {
        const hdrs = await authHeaders()
        const res  = await fetch(`${API}/api/health-metrics?metric=sleep&source=oura`, { headers: hdrs })
        if (res.ok && mountedRef.current) {
          const json = await res.json()
          if (json.connected && json.data?.hours) {
            setExternal({ ...json.data, source: 'Oura' })
            if (!sleepHours) onChange?.(json.data.hours)
            return
          }
        }
      }

      // ── 3. Google Fit (web only, if connected) ────────────────────────────
      if (!Capacitor.isNativePlatform()) {
        const hdrs = await authHeaders()
        const res  = await fetch(`${API}/api/google/sleep`, { headers: hdrs, cache: 'no-store' })
        if (res.ok && mountedRef.current) {
          const json = await res.json()
          if (json.connected && json.hours) {
            setExternal({
              hours:    json.hours,
              deepMin:  json.deepMin  || null,
              remMin:   json.remMin   || null,
              lightMin: json.lightMin || null,
              source:   'Google Fit',
            })
            if (!sleepHours) onChange?.(json.hours)
          }
        }
      }
    } catch {}
    finally {
      if (mountedRef.current) { setSyncing(false); setSyncDone(true) }
    }
  }

  function handleSaveOura() {
    const pat = ouraInput.trim()
    if (!pat) return
    onSaveOuraPAT?.(pat)
    setOuraInput('')
    setConnectOpen(false)
  }

  async function handleConnectGoogle() {
    if (!authHeaders) return
    setConnectingGoogle(true)
    try {
      const hdrs = await authHeaders()
      const res  = await fetch(`${API}/api/google/auth`, { headers: hdrs, cache: 'no-store' })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || `Could not prepare Google Fit connection (${res.status})`)
      if (!body?.url) throw new Error('Google Fit connection could not be prepared. Try again.')
      window.location.href = body.url
    } catch (err) {
      console.warn('Google Fit connect failed:', err)
      alert(err?.message || 'Could not prepare Google Fit connection. Try again.')
    }
    setConnectingGoogle(false)
  }

  function commit(nextValue) {
    const next = clamp(nextValue)
    setDraft(next ? String(next) : '')
    onChange?.(next)
  }

  function commitDraft() {
    commit(draft === '' ? 0 : draft)
  }

  // 7-day bar data
  const week = useMemo(() => {
    const today  = new Date()
    const byDate = new Map((history || []).map(r => [r.date, r]))
    const rows   = []
    for (let i = 6; i >= 1; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      rows.push({ date, sleepHours: clamp(byDate.get(date)?.sleepHours) })
    }
    rows.push({ date: 'today', sleepHours: hours })
    return rows
  }, [history, hours])

  if (compact) {
    const sleepPct = goal > 0 ? Math.min(1, hours / goal) : 0
    return (
      <div style={{
        background: 'var(--surface)',
        border: '1.5px solid color-mix(in srgb, #8b5cf6 30%, var(--border))',
        borderRadius: 16, padding: '14px 10px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      }}>
        <div style={{ fontSize: 20, lineHeight: 1 }}>☾</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', lineHeight: 1, letterSpacing: '-1px' }}>
          {fmt(hours)}
        </div>
        <div style={{ width: '100%', height: 4, borderRadius: 999, background: 'rgba(139,92,246,0.15)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.round(sleepPct * 100)}%`, background: '#8b5cf6', borderRadius: 999, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 9, fontWeight: 800, color: syncing ? 'var(--muted)' : qual.color, textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: 'center' }}>
          {syncing ? 'Syncing…' : (external?.source ? `via ${external.source}` : qual.label)}
        </div>
      </div>
    )
  }

  return (
    <section style={{
      background: 'linear-gradient(180deg, color-mix(in srgb, #8b5cf6 10%, var(--surface)), var(--surface))',
      border: '1.5px solid color-mix(in srgb, #8b5cf6 26%, var(--border))',
      borderRadius: 20, padding: '18px 18px 16px', marginBottom: 16,
      boxShadow: '0 12px 30px rgba(15,23,42,0.12)',
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 14, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #312e81, #8b5cf6)',
            color: '#fff', boxShadow: '0 10px 24px rgba(139,92,246,0.28)', fontSize: 20,
          }}>☾</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.2px' }}>
              Sleep Cycle
            </div>
            {external?.source ? (
              <SourceBadge source={external.source} syncing={syncing} onSync={() => syncSleep(true)} />
            ) : (
              <button
                onClick={() => setConnectOpen(c => !c)}
                style={{
                  background: connectOpen
                    ? 'color-mix(in srgb, #8b5cf6 14%, transparent)'
                    : 'none',
                  border: connectOpen
                    ? '1px solid color-mix(in srgb, #8b5cf6 35%, transparent)'
                    : 'none',
                  borderRadius: 7, padding: '2px 8px 2px 0',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: syncing ? 'var(--muted)' : '#8b5cf6' }}>
                  {syncing ? 'Syncing…' : connectOpen ? '✕ Close' : '+ Connect tracker'}
                </span>
              </button>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1 }}>
            {fmt(hours)}
          </div>
          <div style={{ fontSize: 10, fontWeight: 800, color: qual.color, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {qual.label}
          </div>
        </div>
      </div>

      {/* ── Connect panel ── */}
      {connectOpen && !external && (
        <div style={{
          background: 'var(--surface2)', borderRadius: 14, padding: '16px',
          marginBottom: 14, border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>
            Auto-sync your sleep data
          </div>

          {/* Oura Ring */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                background: 'linear-gradient(135deg, #4c1d95, #7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              }}>💍</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>Oura Ring</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Sleep score, HRV & stages</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, marginBottom: 5 }}>
              <input
                type="password"
                autoComplete="off"
                placeholder="Paste Personal Access Token…"
                value={ouraInput}
                onChange={e => setOuraInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveOura()}
                style={{
                  background: 'var(--surface)', border: '1.5px solid var(--border)',
                  borderRadius: 10, color: 'var(--text)', font: 'inherit',
                  fontSize: 14, fontWeight: 600, padding: '9px 12px',
                  outline: 'none', minWidth: 0, boxSizing: 'border-box',
                }}
              />
              <button
                disabled={!ouraInput.trim()}
                onClick={handleSaveOura}
                style={{
                  background: '#7c3aed', color: '#fff', border: 'none',
                  borderRadius: 10, padding: '0 16px', fontSize: 12, fontWeight: 800,
                  cursor: ouraInput.trim() ? 'pointer' : 'default',
                  opacity: ouraInput.trim() ? 1 : 0.4, flexShrink: 0,
                }}
              >Save</button>
            </div>
            <div style={{ fontSize: 9, color: 'var(--muted)', lineHeight: 1.5 }}>
              cloud.ouraring.com → Account → Personal Access Tokens
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

          {/* Google Fit */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                background: '#4285F4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>Google Fit</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Sleep stages & duration</div>
              </div>
            </div>
            <button
              disabled={connectingGoogle || !authHeaders}
              onClick={handleConnectGoogle}
              style={{
                width: '100%', background: '#4285F4', color: '#fff', border: 'none',
                borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 800,
                cursor: (connectingGoogle || !authHeaders) ? 'default' : 'pointer',
                opacity: (connectingGoogle || !authHeaders) ? 0.65 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {connectingGoogle ? 'Redirecting…' : 'Connect with Google'}
            </button>
          </div>
        </div>
      )}

      {/* ── Oura score + HRV ── */}
      {external?.source === 'Oura' && (
        <ScoreBadge score={external.score} hrv={external.hrv} />
      )}

      {/* ── Sleep stages ── */}
      {external && (external.deepMin || external.remMin || external.lightMin) && (
        <StagePills
          deepMin={external.deepMin}
          remMin={external.remMin}
          lightMin={external.lightMin}
          awakeMin={external.awakeMin}
        />
      )}

      {/* ── Progress bar ── */}
      <div style={{ height: 8, borderRadius: 999, background: 'rgba(128,128,128,0.16)', overflow: 'hidden', marginBottom: 12 }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 999,
          background: 'linear-gradient(90deg, #38bdf8, #8b5cf6)',
          transition: 'width 0.25s ease',
        }} />
      </div>

      {recentSleepSession && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8,
          marginBottom: 12,
        }}>
          {[
            ['Bed', recentSleepSession.bedTime || (recentSleepSession.bedAt ? new Date(recentSleepSession.bedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Not logged')],
            ['Wake', recentSleepSession.wakeTime || (recentSleepSession.wakeAt ? new Date(recentSleepSession.wakeAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Open')],
          ].map(([label, value]) => (
            <div key={label} style={{
              background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.16)',
              borderRadius: 11, padding: '8px 10px', minWidth: 0,
            }}>
              <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.45 }}>{label}</div>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 900, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Manual input ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 12 }}>
        <input
          type="number" inputMode="decimal" min="0" max="24" step="0.25"
          placeholder={external?.hours ? `Auto: ${fmt(external.hours)} — override` : 'Hours slept'}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          style={{
            width: '100%', minWidth: 0, boxSizing: 'border-box',
            background: 'var(--surface2)', border: '1.5px solid var(--border)',
            borderRadius: 12, color: 'var(--text)', font: 'inherit',
            fontSize: 16, fontWeight: 700, padding: '11px 12px', outline: 'none',
          }}
        />
        <button type="button" onClick={commitDraft} style={{
          border: 'none', borderRadius: 12, background: '#8b5cf6', color: '#fff',
          padding: '0 14px', fontSize: 13, fontWeight: 900, cursor: 'pointer',
        }}>
          Save
        </button>
      </div>

      {/* ── Quick buttons ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 10 }}>
        {[6, 7, 8].map(v => (
          <button key={v} type="button" onClick={() => commit(v)} style={quickBtn}>{v}h</button>
        ))}
        <button type="button" onClick={() => commit(hours + 0.5)}           style={quickBtn}>+0.5</button>
        <button type="button" onClick={() => commit(Math.max(0, hours - 0.5))} style={quickBtn}>−0.5</button>
      </div>

      {/* ── Clear today ── */}
      {onClear && (hours > 0 || (Array.isArray(sleepLog) && sleepLog.length > 0)) && (
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => { setDraft(''); onClear() }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, color: '#ef4444',
              opacity: 0.65, padding: '4px 8px',
              letterSpacing: '0.2px',
            }}
          >
            Clear today
          </button>
        </div>
      )}

      {/* ── 7-day bars ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: 58 }}>
        {week.map((day, idx) => {
          const h      = clamp(day.sleepHours)
          const barPct = Math.min(1, h / Math.max(goal, 1))
          const isToday = idx === week.length - 1
          return (
            <div
              key={`${day.date}-${idx}`}
              style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}
              title={`${day.date}: ${fmt(h)}`}
            >
              <div style={{
                width: '100%', maxWidth: 28,
                height: Math.max(h > 0 ? 8 : 3, barPct * 46),
                borderRadius: 999,
                background: h >= goal
                  ? 'linear-gradient(180deg, #a78bfa, #7c3aed)'
                  : isToday
                    ? 'linear-gradient(180deg, #38bdf8, #8b5cf6)'
                    : 'rgba(128,128,128,0.24)',
                boxShadow: isToday ? '0 0 0 3px rgba(139,92,246,0.12)' : 'none',
                transition: 'height 0.2s ease',
              }} />
              <span style={{ fontSize: 9, fontWeight: 800, color: isToday ? '#8b5cf6' : 'var(--muted)' }}>
                {isToday ? 'T' : new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
