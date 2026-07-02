import { useState, useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { HealthBridge } from '../lib/health.js'
import { useT } from './LanguageContext.jsx'
import { displayStepsForStatus, localDateKey, numericSteps, reconcileGoogleFitStepData, reconcileStepData } from './stepSync.js'

const API       = import.meta.env.VITE_API_URL || ''
const STEP_GOAL = 10000

// ── StepRing — large, centered ────────────────────────────────────────────────

function StepRing({ steps, goal = STEP_GOAL }) {
  const t = useT()
  const sz = 92, sw = 8, r = (sz - sw) / 2
  const circ = 2 * Math.PI * r
  const pct  = Math.min(1, steps / goal)
  const done = pct >= 1
  const color = done ? 'var(--success)' : 'var(--muted)'
  return (
    <div style={{ position: 'relative', width: sz, height: sz, flexShrink: 0 }}>
      <svg width={sz} height={sz} style={{ display: 'block' }}>
        <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke="var(--border)" strokeWidth={sw} />
        <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${(circ * pct).toFixed(1)} ${circ}`}
          transform={`rotate(-90 ${sz/2} ${sz/2})`}
          style={{ transition: 'stroke-dasharray 0.35s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: '-0.8px', lineHeight: 1, color: 'var(--text)' }}>
          {steps.toLocaleString()}
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 3 }}>
          {t('ex_steps')}
        </div>
      </div>
    </div>
  )
}

// ── WeekBars ──────────────────────────────────────────────────────────────────

function fmtStepDate(date) {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function WeekBars({ week, goal = STEP_GOAL }) {
  const [selected, setSelected] = useState(null)
  if (!week || !week.length) return null

  const max = Math.max(...week.map(d => d.steps), 1)
  const activeIdx = selected != null ? selected : week.length - 1

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 54 }}>
        {week.map((d, i) => {
          const pct      = d.steps / max
          const barH     = Math.max(pct > 0 ? 7 : 3, pct * 46)
          const isToday  = i === week.length - 1
          const hit      = d.steps >= goal
          const isActive = i === activeIdx
          return (
            <button
              key={d.date}
              type="button"
              title={`${fmtStepDate(d.date)}: ${d.steps.toLocaleString()} steps`}
              aria-label={`${fmtStepDate(d.date)}: ${d.steps.toLocaleString()} steps`}
              onMouseEnter={() => setSelected(i)}
              onFocus={() => setSelected(i)}
              onClick={() => setSelected(i)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                justifyContent: 'flex-end', border: 0, background: 'transparent', padding: 0,
                cursor: 'pointer', minWidth: 0,
              }}
            >
              <div style={{
                position: 'relative', width: '100%', maxWidth: 22, height: barH,
                borderRadius: 999,
                background: hit
                  ? 'var(--success)'
                  : isToday || isActive
                    ? 'var(--muted)'
                    : 'rgba(128,128,128,0.22)',
                opacity: isActive ? 1 : 0.82,
                transition: 'height 0.25s ease, opacity 0.15s',
              }} />
              <span style={{
                fontSize: 9, fontWeight: 800,
                color: isToday ? 'var(--text)' : 'var(--muted)',
                letterSpacing: '0.2px',
              }}>
                {new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Spin ──────────────────────────────────────────────────────────────────────

function Spin() {
  return (
    <div style={{
      width: 18, height: 18, flexShrink: 0,
      border: '2px solid rgba(128,128,128,0.2)',
      borderTopColor: 'var(--accent)',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}

// ── Walking person icon ───────────────────────────────────────────────────────

function WalkingPerson({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--muted)', flexShrink: 0 }}>
      <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/>
    </svg>
  )
}

// ── Google "G" logo ───────────────────────────────────────────────────────────

function GoogleG({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  )
}

// ── Connect card ──────────────────────────────────────────────────────────────

function GoogleFitConnectCard({ onConnect, onRetry, authUrl, error, reconnect }) {
  const t = useT()
  const ready = !!authUrl && !error
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1.5px solid var(--border)',
      borderRadius: 20,
      padding: '22px 18px 20px',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <GoogleG size={24} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>
            {t('fit_connect')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
            {t('fit_sub')}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {[t('fit_daily'), t('fit_week'), t('fit_realtime')].map(f => (
          <div key={f} style={{
            fontSize: 11, fontWeight: 600, color: 'var(--muted)',
            background: 'var(--surface2)', borderRadius: 8, padding: '4px 9px',
          }}>{f}</div>
        ))}
      </div>

      {reconnect && !error && (
        <div style={{
          fontSize: 12, color: '#f59e0b', marginBottom: 12,
          background: 'rgba(245,158,11,0.08)', borderRadius: 10,
          padding: '8px 12px', lineHeight: 1.5,
        }}>
          Google Fit connection expired — tap below to reconnect.
        </div>
      )}

      {error && (
        <div style={{
          fontSize: 12, color: '#ef4444', marginBottom: 12,
          background: 'rgba(239,68,68,0.08)', borderRadius: 10,
          padding: '8px 12px', lineHeight: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}>
          <span>{error}</span>
          <button onClick={onRetry} style={{
            fontSize: 12, fontWeight: 700, color: 'var(--accent)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
          }}>Retry</button>
        </div>
      )}

      <button
        onClick={ready ? onConnect : undefined}
        disabled={!ready}
        style={{
          width: '100%', padding: '12px 0', borderRadius: 14, border: 'none',
          background: ready ? '#fff' : 'var(--surface2)',
          color: ready ? '#3c4043' : 'var(--muted)',
          fontSize: 14, fontWeight: 700, cursor: ready ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: ready ? '0 1px 6px rgba(0,0,0,0.28)' : 'none',
          opacity: !authUrl && !error ? 0.6 : 1,
        }}
      >
        {!authUrl && !error
          ? <><Spin /><span>{t('fit_preparing')}</span></>
          : <><GoogleG size={18} /><span>{reconnect ? 'Reconnect with Google' : t('fit_connect')}</span></>}
      </button>
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div style={{
      position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
      background: '#22c55e', color: '#fff', fontSize: 13, fontWeight: 700,
      padding: '10px 20px', borderRadius: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
      zIndex: 900, whiteSpace: 'nowrap', animation: 'toastIn 0.25s ease',
    }}>
      {message}
    </div>
  )
}

// ── Shared card style ─────────────────────────────────────────────────────────

const cardStyle = {
  background: 'var(--surface)',
  border: '1.5px solid var(--border)',
  borderRadius: 16,
  padding: '14px 16px',
  marginBottom: 12,
}

const globalStyles = (
  <style>{`@keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`}</style>
)

// ── StepsCard — unified steps card (no reps/hero) ─────────────────────────────

export default function StepsCard({ dayData, authHeaders, onStepsUpdate, stepGoal = STEP_GOAL, compact = false }) {
  const t = useT()
  const [status,       setStatus]       = useState('loading')
  const [todaySteps,   setTodaySteps]   = useState(0)
  const [week,         setWeek]         = useState([])
  const [source,       setSource]       = useState(null)
  const [lastSync,     setLastSync]     = useState(null)
  const [syncing,      setSyncing]      = useState(false)
  const [authUrl,      setAuthUrl]      = useState(null)
  const [connectError, setConnectError] = useState(null)
  const [toast,           setToast]           = useState(null)
  const [disconnectReason, setDisconnectReason] = useState(null)
  const mounted = useRef(true)

  const localSteps = numericSteps(dayData?.steps)
  const steps = displayStepsForStatus({ status, todaySteps, localSteps })

  useEffect(() => {
    mounted.current = true
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === 'true') {
      setToast('fit_toast')
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('google_error')) {
      console.warn('Google Fit error:', params.get('google_error'))
      window.history.replaceState({}, '', window.location.pathname)
    }
    init().catch(() => { if (mounted.current) setStatus('disconnected') })
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (status !== 'ready' || source === 'Google Fit') return
    const local = numericSteps(dayData?.steps)
    if (local <= todaySteps) return
    const synced = reconcileStepData(todaySteps, week, local)
    setTodaySteps(synced.today)
    setWeek(synced.week)
  }, [dayData?.steps, status, source, todaySteps, week])

  // Auto-sync when app returns to foreground
  useEffect(() => {
    if (status !== 'ready') return
    const isWeb = !Capacitor.isNativePlatform()
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      if (isWeb) syncGoogleFit()
      else syncHealth()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [status]) // eslint-disable-line

  async function init() {
    if (!Capacitor.isNativePlatform()) {
      await fetchGoogleFit()
      return
    }
    const platform = Capacitor.getPlatform()
    setSource(platform === 'ios' ? 'Apple Health' : 'Health Connect')
    const available = await HealthBridge.isAvailable()
    if (!available) {
      setStatus('unavailable')
      await fetchFromApi()
      return
    }
    await syncHealth()
  }

  async function fetchGoogleFit(reconnectOnFailure = false) {
    try {
      const hdrs = await authHeaders()
      const res  = await fetch(`${API}/api/google/steps`, { headers: hdrs, cache: 'no-store' })
      if (!mounted.current) return
      if (!res.ok) {
        await fetchFromApi()
        setSource('Saved steps')
        setDisconnectReason('request_failed')
        setStatus('disconnected')
        const url = await prefetchAuthUrl()
        if (reconnectOnFailure && url) window.location.href = url
        return false
      }
      const data = await res.json()
      if (!mounted.current) return
      if (!data.connected) {
        await fetchFromApi()
        setSource('Saved steps')
        setDisconnectReason(data.reason || 'not_connected')
        setStatus('disconnected')
        const url = await prefetchAuthUrl()
        if (reconnectOnFailure && url) window.location.href = url
        return false
      }
      setDisconnectReason(null)
      const synced = reconcileGoogleFitStepData(data.today, data.week)
      setTodaySteps(synced.today)
      setWeek(synced.week)
      setSource('Google Fit')
      setLastSync(new Date())
      setStatus('ready')
      onStepsUpdate?.(synced.today)
      return true
    } catch {
      if (mounted.current) {
        await fetchFromApi()
        setSource('Saved steps')
        setDisconnectReason('request_failed')
        setStatus('disconnected')
        const url = await prefetchAuthUrl()
        if (reconnectOnFailure && url) window.location.href = url
      }
      return false
    }
  }

  async function prefetchAuthUrl() {
    setAuthUrl(null)
    setConnectError(null)
    try {
      const hdrs = await authHeaders()
      const res  = await fetch(`${API}/api/google/auth`, { headers: hdrs, cache: 'no-store' })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || `Could not prepare Google Fit connection (${res.status})`)
      if (!body?.url) throw new Error('Google Fit connection could not be prepared. Tap Retry and try again.')
      if (mounted.current) setAuthUrl(body.url)
      return body.url
    } catch (err) {
      if (mounted.current) setConnectError(err?.message || 'Could not prepare Google Fit connection. Tap Retry and try again.')
      return null
    }
  }

  function connectGoogleFit() {
    if (!authUrl) {
      setConnectError('Google Fit connection is not ready yet. Tap Retry and try again.')
      return
    }
    window.location.href = authUrl
  }

  async function syncGoogleFit() {
    if (!mounted.current) return
    setSyncing(true)
    try { await fetchGoogleFit(true) }
    finally { if (mounted.current) setSyncing(false) }
  }

  async function handleCompactSync(event) {
    event.stopPropagation()
    if (syncing || status === 'loading') return
    if (Capacitor.isNativePlatform()) {
      syncHealth()
      return
    }
    if (status === 'disconnected') {
      setSyncing(true)
      try {
        const url = authUrl || await prefetchAuthUrl()
        if (url) window.location.href = url
      } finally {
        if (mounted.current) setSyncing(false)
      }
      return
    }
    syncGoogleFit()
  }

  async function fetchFromApi() {
    try {
      const hdrs = await authHeaders()
      const res  = await fetch(`${API}/api/health-metrics?metric=steps`, { headers: hdrs })
      if (!res.ok || !mounted.current) return null
      const data = await res.json()
      const synced = reconcileStepData(data.today, data.week, dayData?.steps)
      setTodaySteps(synced.today)
      setWeek(synced.week)
      return synced
    } catch {
      return null
    }
  }

  async function syncHealth() {
    if (!mounted.current) return
    setSyncing(true)
    try {
      await HealthBridge.requestPermissions()
      const [today, weekData] = await Promise.all([
        HealthBridge.getTodaySteps(),
        HealthBridge.getWeekSteps(),
      ])
      if (!mounted.current) return
      const synced = reconcileStepData(today, weekData, dayData?.steps)
      setTodaySteps(synced.today)
      setWeek(synced.week)
      setLastSync(new Date())
      onStepsUpdate?.(synced.today)

      const platform   = Capacitor.getPlatform()
      const sourceName = platform === 'ios' ? 'healthkit' : 'health_connect'
      const todayDate  = localDateKey()
      const hdrs       = await authHeaders()

      await fetch(`${API}/api/health-metrics?metric=steps`, {
        method: 'POST',
        headers: { ...hdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: todayDate, steps: synced.today, source: sourceName }),
      })
      for (const d of synced.week) {
        if (d.date !== todayDate) {
          fetch(`${API}/api/health-metrics?metric=steps`, {
            method: 'POST',
            headers: { ...hdrs, 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: d.date, steps: d.steps, source: sourceName }),
          }).catch(() => {})
        }
      }
      setStatus('ready')
    } catch (err) {
      const msg = String(err).toLowerCase()
      setStatus(msg.includes('permission') || msg.includes('denied') || msg.includes('authorization')
        ? 'permission_denied' : 'ready')
    } finally {
      if (mounted.current) setSyncing(false)
    }
  }

  // ── Shared header sub-element ─────────────────────────────────────────────

  function CardHeader({ showSync = false }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          {(source === 'Google Fit' || status === 'loading') && <WalkingPerson size={18} />}
          {(source === 'Apple Health' || source === 'Health Connect') && (
            <div style={{ width: 18, height: 18, borderRadius: 5, background: 'linear-gradient(135deg, #ff2d55, #ff6b6b)', flexShrink: 0 }} />
          )}
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.2px' }}>{t('steps_title')}</div>
            {source && (
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginTop: 1 }}>
                via {source}
              </div>
            )}
            {lastSync && (
              <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 1 }}>
                {lastSync.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>
        {showSync ? (
          <button
            onClick={source === 'Google Fit' ? syncGoogleFit : syncHealth}
            disabled={syncing}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '5px 12px',
              fontSize: 12, fontWeight: 700, color: 'var(--muted)',
              cursor: syncing ? 'default' : 'pointer', opacity: syncing ? 0.6 : 1,
            }}
          >
            {syncing && <Spin />}
            {syncing ? t('syncing') : t('sync')}
          </button>
        ) : (
          <Spin />
        )}
      </div>
    )
  }

  // ── Compact mode (3-column grid) ─────────────────────────────────────────

  if (compact) {
    const isStepSyncing = status === 'loading' || syncing
    const stepPct   = Math.min(1, steps / stepGoal)
    const stepLabel = isStepSyncing && steps === 0
      ? '…'
      : steps >= 1000
        ? `${(steps / 1000).toFixed(1)}k`
        : steps.toLocaleString()
    const hasSteps  = steps > 0
    const isConn    = status !== 'disconnected' || hasSteps || isStepSyncing
    return (
      <>
        {globalStyles}
        {toast && <Toast message={t(toast)} onDone={() => setToast(null)} />}
        <div
          aria-busy={isStepSyncing}
          title={isStepSyncing ? 'Syncing latest steps…' : undefined}
          style={{
            background: 'var(--surface)', border: '1.5px solid var(--border)',
            borderRadius: 16, padding: '14px 10px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          }}
        >
          <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
            <WalkingPerson size={20} />
            {isStepSyncing && (
              <span style={{ position: 'absolute', right: -8, top: -7, transform: 'scale(0.7)', transformOrigin: 'center' }}>
                <Spin />
              </span>
            )}
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', lineHeight: 1, letterSpacing: '-1px' }}>
            {isConn ? stepLabel : '—'}
          </div>
          <div style={{ width: '100%', height: 4, borderRadius: 999, background: 'rgba(128,128,128,0.15)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round(stepPct * 100)}%`, background: stepPct >= 1 ? 'var(--success)' : 'var(--accent)', borderRadius: 999, transition: 'width 0.3s' }} />
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            {isStepSyncing ? 'Syncing steps…' : isConn ? `/ ${(stepGoal / 1000).toFixed(0)}k steps` : 'Tap to connect'}
          </div>
          <button
            type="button"
            onClick={handleCompactSync}
            disabled={isStepSyncing}
            aria-label={status === 'disconnected' ? 'Reconnect Google Fit' : 'Sync steps with Google Fit'}
            title={status === 'disconnected' ? 'Reconnect Google Fit' : 'Sync steps with Google Fit'}
            style={{
              marginTop: 2, padding: '5px 11px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--surface2)',
              color: 'var(--text)', fontSize: 10, fontWeight: 800,
              cursor: isStepSyncing ? 'default' : 'pointer',
              opacity: isStepSyncing ? 0.6 : 1,
            }}
          >
            {isStepSyncing ? 'Syncing…' : status === 'disconnected' ? 'Reconnect' : 'Sync'}
          </button>
        </div>
      </>
    )
  }

  // ── Status: loading ───────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <>
        {globalStyles}
        {toast && <Toast message={t(toast)} onDone={() => setToast(null)} />}
        <div style={cardStyle}>
          <CardHeader showSync={false} />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <StepRing steps={steps} goal={stepGoal} />
          </div>
        </div>
      </>
    )
  }

  // ── Status: disconnected ──────────────────────────────────────────────────

  if (status === 'disconnected') {
    return (
      <>
        {globalStyles}
        {toast && <Toast message={t(toast)} onDone={() => setToast(null)} />}
        <GoogleFitConnectCard
          onConnect={connectGoogleFit}
          onRetry={prefetchAuthUrl}
          authUrl={authUrl}
          error={connectError}
          reconnect={disconnectReason === 'token_expired'}
        />
      </>
    )
  }

  // ── Status: unavailable ───────────────────────────────────────────────────

  if (status === 'unavailable') {
    return (
      <>
        {globalStyles}
        {toast && <Toast message={t(toast)} onDone={() => setToast(null)} />}
        <div style={cardStyle}>
          <CardHeader showSync={false} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <StepRing steps={steps} goal={stepGoal} />
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.45 }}>
              Health Connect not available on this device.
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── Status: permission_denied ─────────────────────────────────────────────

  if (status === 'permission_denied') {
    return (
      <>
        {globalStyles}
        {toast && <Toast message={t(toast)} onDone={() => setToast(null)} />}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{t('steps_title')}</div>
          </div>
          <button
            onClick={() => { setStatus('loading'); syncHealth() }}
            style={{
              width: '100%', padding: 13, borderRadius: 14, border: 'none',
              background: 'var(--accent)', color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Allow Step Access
          </button>
        </div>
      </>
    )
  }

  // ── Status: ready ─────────────────────────────────────────────────────────

  return (
    <>
      {globalStyles}
      {toast && <Toast message={t(toast)} onDone={() => setToast(null)} />}
      <div style={cardStyle}>
        <CardHeader showSync={true} />

        {/* Compact tracker row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <StepRing steps={steps} goal={stepGoal} />
          {week.length > 0 ? (
            <WeekBars week={week} goal={stepGoal} />
          ) : (
            <div style={{ flex: 1, fontSize: 12, color: 'var(--muted)', lineHeight: 1.45 }}>
              Passive step count, kept secondary to workouts.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
