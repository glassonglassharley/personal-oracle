import { useState, useMemo } from 'react'
import RobinhoodChart from './RobinhoodChart.jsx'

const API = import.meta.env.VITE_API_URL || ''

function fmtSeconds(total) {
  const s = Math.max(0, Math.round(Number(total) || 0))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (s < 3600) return rem === 0 ? `${m}m` : `${m}m ${rem}s`
  const h = Math.floor(m / 60)
  const mrem = m % 60
  return mrem === 0 ? `${h}h` : `${h}h ${mrem}m`
}

function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function buildGrowthSeries(history) {
  const byDate = new Map()
  for (const day of history) {
    if (!day?.date) continue
    byDate.set(day.date, typeof day.meditation === 'number' ? day.meditation : 0)
  }
  const dates = [...byDate.keys()].sort()
  if (!dates.length) return []
  const start = new Date(dates[0] + 'T00:00:00')
  const end = new Date(localDate(new Date()) + 'T00:00:00')
  const points = []
  let cumulative = 0
  for (const cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
    const date = localDate(cur)
    cumulative += byDate.get(date) || 0
    points.push({ date, value: cumulative })
  }
  return points
}

function calcStreak(history) {
  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date))
  if (!sorted.length) return 0
  const _n = new Date()
  const today = localDate(_n)
  const _y = new Date(_n); _y.setDate(_n.getDate() - 1)
  const yesterday = localDate(_y)
  if (sorted[0].date < yesterday) return 0
  let streak = 0, prev = null
  for (const day of sorted) {
    if ((typeof day.meditation === 'number' ? day.meditation : 0) <= 0) break
    if (prev) {
      const gap = (new Date(prev + 'T00:00:00') - new Date(day.date + 'T00:00:00')) / 86400000
      if (gap > 1) break
    }
    streak++; prev = day.date
  }
  return streak
}

const MILESTONES = [60, 300, 600, 1800, 3600, 7200, 18000]

export default function MeditationDetail({ history, dayData, goals, onBack, theme, authHeaders, onRefresh }) {
  const color = '#38BDF8'
  const todayStr = localDate(new Date())
  const [editEntry, setEditEntry] = useState(null)
  const [editSaving, setEditSaving] = useState(false)

  const fullHistory = useMemo(() => {
    const todayEntry = { date: todayStr, ...dayData }
    return (dayData.meditation || 0) > 0 ? [todayEntry, ...history] : history
  }, [history, dayData, todayStr])

  const active = fullHistory.filter(d => (typeof d.meditation === 'number' ? d.meditation : 0) > 0)
  const daysLogged = active.length
  const streak = calcStreak(fullHistory)
  const totalSec = fullHistory.reduce((s, d) => s + (typeof d.meditation === 'number' ? d.meditation : 0), 0)
  const bestDay = Math.max(0, ...fullHistory.map(d => typeof d.meditation === 'number' ? d.meditation : 0))
  const avgSec = daysLogged > 0 ? Math.round(totalSec / daysLogged) : 0
  const goal = goals?.meditation ?? null

  const chartPoints = useMemo(() => buildGrowthSeries(fullHistory), [fullHistory])

  const sessionLog = useMemo(() => {
    return fullHistory
      .filter(d => (typeof d.meditation === 'number' ? d.meditation : 0) > 0)
      .map(d => ({ date: d.date, secs: d.meditation }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 200)
  }, [fullHistory])

  const unlocked = MILESTONES.filter(m => totalSec >= m)
  const nextMs = MILESTONES.find(m => totalSec < m) || null
  const nextPct = nextMs ? totalSec / nextMs : 1

  const todayVal = typeof dayData.meditation === 'number' ? dayData.meditation : 0
  const todayGoalPct = goal > 0 ? Math.min(1, todayVal / goal) : 0
  const todayDone = goal > 0 && todayVal >= goal

  async function handleSaveEntry() {
    if (!editEntry || editSaving || !authHeaders) return
    setEditSaving(true)
    try {
      const hdrs = await authHeaders()
      await fetch(`${API}/api/log`, {
        method: 'POST',
        headers: { ...hdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_day', date: editEntry.date, data: { meditation: Number(editEntry.secs) || 0 } }),
      })
      setEditEntry(null)
      onRefresh?.()
    } catch {}
    finally { setEditSaving(false) }
  }

  async function handleDeleteEntry() {
    if (!editEntry || editSaving || !authHeaders) return
    setEditSaving(true)
    try {
      const hdrs = await authHeaders()
      await fetch(`${API}/api/log`, {
        method: 'POST',
        headers: { ...hdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_day', date: editEntry.date, data: { meditation: null } }),
      })
      setEditEntry(null)
      onRefresh?.()
    } catch {}
    finally { setEditSaving(false) }
  }

  return (
    <div className="exercise-detail">
      <div className="detail-header">
        <button className="detail-back" onClick={onBack}>‹ Back</button>
        <span className="detail-title" style={{ color }}>Meditation</span>
      </div>

      <RobinhoodChart
        points={chartPoints}
        color={color}
        ranges={['1W', '1M', '1Y', '5Y']}
        defaultRange="1M"
        isDark={theme === 'dark'}
        unit="seconds"
        title="Meditation growth"
        subtitle="total accumulated time"
        emptyLabel="Log meditation sessions to see your growth chart"
      />

      {goal > 0 && (
        <div className="detail-today">
          <div className="dt-label-row">
            <span className="dt-label">Today</span>
            <span className={`dt-val ${todayDone ? 'dt-done' : ''}`}>
              {fmtSeconds(todayVal)} / {fmtSeconds(goal)}{todayDone ? ' ✓' : ''}
            </span>
          </div>
          <div className="dt-track">
            <div className="dt-fill" style={{ width: `${(todayGoalPct * 100).toFixed(1)}%`, background: todayDone ? '#4ade80' : color }} />
          </div>
        </div>
      )}

      <div className="detail-hero">
        <div className="dh-num" style={{ color }}>{fmtSeconds(totalSec)}</div>
        <div className="dh-label">total accumulated time</div>
      </div>

      <div className="detail-stats">
        <div className="ds-card">
          <span className="ds-num">{streak}</span>
          <span className="ds-lbl">day streak</span>
        </div>
        <div className="ds-card">
          <span className="ds-num">{fmtSeconds(bestDay)}</span>
          <span className="ds-lbl">best day</span>
        </div>
        <div className="ds-card">
          <span className="ds-num">{daysLogged}</span>
          <span className="ds-lbl">days logged</span>
        </div>
        <div className="ds-card">
          <span className="ds-num">{fmtSeconds(avgSec)}</span>
          <span className="ds-lbl">avg / day</span>
        </div>
      </div>

      {sessionLog.length > 0 && (
        <div className="detail-section">
          <h3 className="detail-sec-hd">
            Session Log
            {authHeaders && <span className="detail-sec-sub">tap entry to edit</span>}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 320, overflowY: 'auto' }}>
            {sessionLog.map(({ date, secs }) => {
              const canEdit = !!authHeaders
              return (
                <div
                  key={date}
                  onClick={() => canEdit && setEditEntry({ date, secs })}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: 'var(--surface)',
                    borderRadius: 10, border: '1px solid var(--border)',
                    cursor: canEdit ? 'pointer' : 'default',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                    {fmtSeconds(secs)}
                  </span>
                  {canEdit && <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>✎</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="detail-section">
        <h3 className="detail-sec-hd">Milestones</h3>
        <div className="ms-list">
          {unlocked.length === 0 && !nextMs && (
            <p className="detail-nil">Log meditation to earn milestones</p>
          )}
          {nextMs && (
            <div className="ms-next">
              <div className="ms-next-row">
                <span className="ms-next-label">{fmtSeconds(nextMs)}</span>
                <span className="ms-next-remain">{fmtSeconds(nextMs - totalSec)} to go</span>
              </div>
              <div className="ms-track">
                <div className="ms-fill" style={{ width: `${(nextPct * 100).toFixed(1)}%`, background: 'rgba(56,189,248,0.85)' }} />
              </div>
            </div>
          )}
          <div className="ms-done-list">
            {[...unlocked].reverse().map(m => (
              <div key={m} className="ms-done">
                <span className="ms-check" style={{ color }}>✓</span>
                <span>{fmtSeconds(m)}</span>
              </div>
            ))}
          </div>
          {nextMs == null && unlocked.length > 0 && (
            <div className="ms-done ms-all"><span>All milestones complete!</span></div>
          )}
        </div>
      </div>

      {editEntry && (
        <>
          <div
            onClick={() => { if (!editSaving) setEditEntry(null) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, backdropFilter: 'blur(2px)' }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
            background: 'var(--bg)', borderRadius: '22px 22px 0 0',
            padding: '0 20px 48px', boxShadow: '0 -8px 40px rgba(0,0,0,0.35)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4 }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '10px 0 16px' }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>Edit Entry</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                  {new Date(editEntry.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <button
                onClick={() => !editSaving && setEditEntry(null)}
                style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--surface2)', color: 'var(--muted)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0 }}
              >✕</button>
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>Duration (seconds)</div>
              <input
                type="number" inputMode="numeric"
                value={editEntry.secs}
                onChange={e => setEditEntry(prev => ({ ...prev, secs: e.target.value }))}
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 24, fontWeight: 800, textAlign: 'center', padding: '12px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleSaveEntry} disabled={editSaving}
                style={{ flex: 1, padding: '14px', background: color, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: editSaving ? 'default' : 'pointer', opacity: editSaving ? 0.6 : 1 }}>
                {editSaving ? '…' : 'Save'}
              </button>
              <button onClick={handleDeleteEntry} disabled={editSaving}
                style={{ flex: 1, padding: '14px', background: '#ef444420', color: '#ef4444', border: '1.5px solid #ef444440', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: editSaving ? 'default' : 'pointer', opacity: editSaving ? 0.6 : 1 }}>
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
