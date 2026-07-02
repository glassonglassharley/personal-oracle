import { useState, useMemo } from 'react'
import RobinhoodChart from './RobinhoodChart.jsx'

const API = import.meta.env.VITE_API_URL || ''

// ── Helpers ───────────────────────────────────────────────────────────────────

function exVal(day, id, type) {
  const v = day[id]
  if (v == null) return 0
  if (typeof v === 'object') return Number(v.reps || 0)
  return typeof v === 'number' ? v : 0
}

function exReps(day, id) {
  const v = day[id]
  if (v == null) return 0
  if (typeof v === 'object') return v.reps || 0
  return typeof v === 'number' ? v : 0
}

function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function calcStreak(history, id, type) {
  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date))
  if (!sorted.length) return 0
  // If the most recent logged day is older than yesterday, the streak is already broken
  const _n = new Date()
  const today     = localDate(_n)
  const _y = new Date(_n); _y.setDate(_n.getDate() - 1)
  const yesterday = localDate(_y)
  if (sorted[0].date < yesterday) return 0
  let streak = 0, prev = null
  for (const day of sorted) {
    if (exVal(day, id, type) <= 0) break
    if (prev) {
      const gap = (new Date(prev + 'T00:00:00') - new Date(day.date + 'T00:00:00')) / 86400000
      if (gap > 1) break
    }
    streak++; prev = day.date
  }
  return streak
}

function calcPR(history, id, type) {
  return Math.max(0, ...history.map(d => exVal(d, id, type)))
}

function calcAvgReps(history, id, type) {
  const active = history.filter(d => exVal(d, id, type) > 0)
  if (!active.length) return 0
  const total = active.reduce((s, d) => s + exReps(d, id), 0)
  return Math.round(total / active.length)
}

function exWeight(day, id, type) {
  if (type === 'bench') return day[id]?.weight || 0
  if (type === 'weighted_reps') return day[`${id}Weight`] || 0
  return 0
}

function buildWeightHistory(history, id, type) {
  if (type !== 'bench' && type !== 'weighted_reps') return []
  return history
    .filter(d => exReps(d, id) > 0)
    .map(d => ({ date: d.date, weight: exWeight(d, id, type), reps: exReps(d, id) }))
    .filter(e => e.weight > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
}

function buildWeightBreakdown(sessions) {
  const map = new Map()
  for (const { weight, reps } of sessions) {
    const cur = map.get(weight) || { sessions: 0, totalReps: 0 }
    map.set(weight, { sessions: cur.sessions + 1, totalReps: cur.totalReps + reps })
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([weight, s]) => ({ weight, ...s }))
}

function buildExerciseGrowthSeries(history, id) {
  const byDate = new Map()
  for (const day of history) {
    if (!day?.date) continue
    byDate.set(day.date, exReps(day, id))
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
    points.push({ date, value: cumulative, day: byDate.get(date) || 0 })
  }

  return points
}

function weekDates(offset = 0) {
  const now = new Date()
  const dow = now.getDay() || 7
  const mon = new Date(now)
  mon.setDate(now.getDate() - (dow - 1) + offset * 7)
  mon.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i)
    return localDate(d)
  })
}

function hexToRgb(hex) {
  const c = hex.replace('#', '')
  return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`
}

function fmtSeconds(total) {
  const s = Math.max(0, Math.round(Number(total) || 0))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem === 0 ? `${m}m` : `${m}m ${rem}s`
}

// ── Milestones ────────────────────────────────────────────────────────────────

const MILESTONE_MAP = {
  pushups: { vals: [1000, 2500, 5000, 10000, 25000], unit: 'reps' },
  squats:  { vals: [1000, 2500, 5000, 10000],         unit: 'reps' },
  situps:  { vals: [1000, 2500, 5000, 10000],         unit: 'reps' },
  pullups: { vals: [1000, 2000, 5000],                unit: 'reps' },
  curls:   { vals: [1000, 2500, 5000],                unit: 'reps' },
  bench:   { vals: [1000, 2500, 5000, 10000],         unit: 'reps' },
  steps:     { vals: [50000, 100000, 250000, 500000, 1000000],   unit: 'steps' },
  meals:     { vals: [50, 100, 250, 500, 1000],                  unit: 'logged' },
  dead_hang: { vals: [60, 300, 600, 1800, 3600],                 unit: 'seconds' },
}

function getMilestones(id, type) {
  if (MILESTONE_MAP[id]) return MILESTONE_MAP[id]
  if (type === 'timed') return { vals: [60, 300, 600, 1800, 3600], unit: 'seconds' }
  return { vals: [1000, 2500, 5000], unit: 'reps' }
}

// ── Line Chart ────────────────────────────────────────────────────────────────

function LineChart({ points, goal, color }) {
  if (points.length < 2) return <div className="chart-empty">Log a few more days to see a trend</div>

  const W = 300, H = 68, pL = 2, pR = 6, pT = 6, pB = 4
  const iW = W - pL - pR, iH = H - pT - pB
  const vals = points.map(p => p.value)
  const maxV = Math.max(goal || 0, ...vals, 1)
  const cx = i => pL + (points.length > 1 ? (i / (points.length - 1)) * iW : iW / 2)
  const cy = v => pT + iH - (v / maxV) * iH
  const prI    = vals.reduce((mi, v, i) => v >= vals[mi] ? i : mi, 0)
  const goalY  = goal ? cy(goal) : null
  const line   = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${cx(i).toFixed(1)},${cy(p.value).toFixed(1)}`).join('')
  const area   = `${line} L${cx(points.length - 1).toFixed(1)},${pT + iH} L${pL},${pT + iH} Z`
  const gradId = `ld${color.replace('#', '')}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="line-chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      {goalY != null && (
        <line x1={pL} y1={goalY.toFixed(1)} x2={W - pR} y2={goalY.toFixed(1)}
          stroke="rgba(128,128,128,0.35)" strokeWidth="1" strokeDasharray="4 3" />
      )}
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={cx(prI).toFixed(1)} cy={cy(vals[prI]).toFixed(1)} r="3.5" fill="#FFD700" />
    </svg>
  )
}

// ── ExerciseDetail ────────────────────────────────────────────────────────────

export default function ExerciseDetail({ def, history, goals, dayData, onBack, theme, authHeaders, onRefresh }) {
  const { id, type, color, name } = def
  const isBench    = false
  const isWeighted = false
  const isTimed    = type === 'timed'
  const goal    = goals?.[id] ?? null
  const rgb     = hexToRgb(color)

  const [editEntry, setEditEntry] = useState(null)
  const [deleteEntry, setDeleteEntry] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const todayStr = localDate(new Date())

  // Combine today into history for stats, letting the live today value replace
  // any same-date server snapshot so totals and charts never disagree.
  const fullHistory = useMemo(() => {
    const todayEntry = { date: todayStr, ...dayData }
    if (exVal(todayEntry, id, type) <= 0) return history
    return [todayEntry, ...history.filter(d => d.date !== todayStr)]
  }, [history, dayData, id, type, todayStr])

  // Robinhood-style cumulative growth points are the canonical total source.
  const chartPoints = useMemo(
    () => buildExerciseGrowthSeries(fullHistory, id),
    [fullHistory, id]
  )
  const chartTotal = chartPoints.length ? chartPoints[chartPoints.length - 1].value : 0

  // Core numbers
  const daysLogged = fullHistory.filter(d => exVal(d, id, type) > 0).length
  const streak     = calcStreak(fullHistory, id, type)
  const pr         = calcPR(fullHistory, id, type)
  const avgReps    = calcAvgReps(fullHistory, id, type)

  // Weekly comparison (use reps for bench to be more intuitive)
  const weekReps = dates =>
    fullHistory.filter(d => dates.includes(d.date)).reduce((s, d) => s + exReps(d, id), 0)
  const thisWeek   = weekReps(weekDates(0))
  const prevWeek   = weekReps(weekDates(-1))
  const weekChange = prevWeek > 0 ? Math.round(((thisWeek - prevWeek) / prevWeek) * 100) : null

  // All-time totals use the same cumulative series source as the chart header.
  const totalReps = chartTotal
  const sessions  = fullHistory.filter(d => exReps(d, id) > 0).length


  // Today's reps value (for progress bar)
  const todayReps = exReps({ [id]: dayData?.[id] }, id)
  const todayGoalPct = goal > 0 ? Math.min(1, todayReps / goal) : 0
  const todayDone = goal > 0 && todayReps >= goal

  // Milestone progress value
  const heroNum   = totalReps

  const prLabel = isTimed ? fmtSeconds(pr) : pr.toLocaleString()

  // Milestones
  const { vals: msVals, unit: msUnit } = getMilestones(id, type)
  const unlocked = msVals.filter(m => heroNum >= m)
  const nextMs   = msVals.find(m => heroNum < m) || null
  const nextPct  = nextMs ? heroNum / nextMs : 1

  // Session log — all exercise types, sorted newest first
  const sessionLog = useMemo(() => {
    return fullHistory
      .filter(d => exReps(d, id) > 0)
      .map(d => ({
        date: d.date,
        reps: exReps(d, id),
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 200)
  }, [fullHistory, id, type])

  async function handleSaveEntry() {
    if (!editEntry || editSaving || !authHeaders) return
    setEditSaving(true)
    setEditError('')
    try {
      const hdrs = await authHeaders()
      const res = await fetch(`${API}/api/log`, {
        method: 'PUT',
        headers: { ...hdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: editEntry.date, exerciseId: id, reps: Number(editEntry.reps) || 0 }),
      })
      if (!res.ok) throw new Error('Save failed')
      setEditEntry(null)
      onRefresh?.()
    } catch {
      setEditError('Could not save. Try again.')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDeleteEntry(date) {
    if (!date || editSaving || !authHeaders) return
    setEditSaving(true)
    setEditError('')
    try {
      const hdrs = await authHeaders()
      const res = await fetch(`${API}/api/log`, {
        method: 'DELETE',
        headers: { ...hdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, exerciseId: id }),
      })
      if (!res.ok) throw new Error('Delete failed')
      setDeleteEntry(null)
      if (editEntry?.date === date) setEditEntry(null)
      onRefresh?.()
    } catch {
      setEditError('Could not delete. Try again.')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="exercise-detail">

      {/* ── Header ── */}
      <div className="detail-header">
        <button className="detail-back" onClick={onBack}>‹ Back</button>
        <span className="detail-title" style={{ color }}>{name}</span>
      </div>

      {/* ── Growth chart ── */}
      <RobinhoodChart
        points={chartPoints}
        color={color}
        ranges={['1W', '1M', '1Y', '5Y']}
        defaultRange="1M"
        isDark={theme === 'dark'}
        unit={isTimed ? 'seconds' : 'reps'}
        title={`${name} growth`}
        subtitle={isTimed ? 'total accumulated time' : 'total accumulated reps'}
        emptyLabel={`Log ${name.toLowerCase()} to see its growth chart`}
      />

      {/* ── Today progress bar ── */}
      {goal > 0 && (
        <div className="detail-today">
          <div className="dt-label-row">
            <span className="dt-label">Today</span>
            <span className={`dt-val ${todayDone ? 'dt-done' : ''}`}>
              {isTimed ? fmtSeconds(todayReps) : todayReps.toLocaleString()} / {isTimed ? fmtSeconds(goal) : goal.toLocaleString()}
              {todayDone && ' ✓'}
            </span>
          </div>
          <div className="dt-track">
            <div className="dt-fill"
              style={{
                width: `${(todayGoalPct * 100).toFixed(1)}%`,
                background: todayDone ? '#4ade80' : color,
              }} />
          </div>
        </div>
      )}

      {/* ── Stats grid ── */}
      <div className="detail-stats">
        <div className="ds-card">
          <span className="ds-num">{streak}</span>
          <span className="ds-lbl">day streak</span>
        </div>
        <div className="ds-card">
          <span className="ds-num">{prLabel}</span>
          <span className="ds-lbl">{isBench ? 'best set' : 'best day'}</span>
        </div>
        <div className="ds-card">
          <span className="ds-num">{daysLogged}</span>
          <span className="ds-lbl">days logged</span>
        </div>
        <div className="ds-card">
          <span className="ds-icon">⌀</span>
          <span className="ds-num">{isTimed ? fmtSeconds(avgReps) : avgReps.toLocaleString()}</span>
          <span className="ds-lbl">avg / session</span>
        </div>
        <div className="ds-card" style={{ gridColumn: 'span 2' }}>
          <div className="ds-week">
            <div>
              <span className="ds-num">{isTimed ? fmtSeconds(thisWeek) : thisWeek.toLocaleString()}</span>
              <span className="ds-lbl"> this week</span>
            </div>
            <div className="ds-vs">vs</div>
            <div>
              <span className="ds-num">{isTimed ? fmtSeconds(prevWeek) : prevWeek.toLocaleString()}</span>
              <span className="ds-lbl"> last week</span>
            </div>
            {weekChange !== null && (
              <span className={`ds-change ${weekChange >= 0 ? 'ds-up' : 'ds-dn'}`}>
                {weekChange >= 0 ? '▲' : '▼'}{Math.abs(weekChange)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Milestones ── */}
      <div className="detail-section">
        <h3 className="detail-sec-hd">Milestones</h3>
        <div className="ms-list">
          {unlocked.length === 0 && !nextMs && (
            <p className="detail-nil">Log workouts to earn milestones</p>
          )}

          {nextMs && (
            <div className="ms-next">
              <div className="ms-next-row">
                <span className="ms-next-label">
                  {nextMs.toLocaleString()} {msUnit}
                </span>
                <span className="ms-next-remain">
                  {(nextMs - heroNum).toLocaleString()} to go
                </span>
              </div>
              <div className="ms-track">
                <div className="ms-fill"
                  style={{ width: `${(nextPct * 100).toFixed(1)}%`, background: `rgba(${rgb},0.85)` }} />
              </div>
            </div>
          )}

          <div className="ms-done-list">
            {[...unlocked].reverse().map(m => (
              <div key={m} className="ms-done">
                <span className="ms-check" style={{ color }}>✓</span>
                <span>{m.toLocaleString()} {msUnit}</span>
              </div>
            ))}
          </div>

          {nextMs == null && unlocked.length > 0 && (
            <div className="ms-done ms-all">
              <span>All milestones complete!</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Session Log (all exercise types, edit/delete historical entries) ── */}
      {sessionLog.length > 0 ? (
        <div className="detail-section">
          <h3 className="detail-sec-hd">Session Log</h3>
          {editError && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{editError}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
            {sessionLog.map(({ date, reps: wr }) => {
              const isEditing = editEntry?.date === date
              const confirming = deleteEntry === date
              return (
                <div key={date} style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    {!isEditing && !confirming && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginRight: 4 }}>
                          {isTimed ? fmtSeconds(wr) : <>{wr.toLocaleString()} <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>reps</span></>}
                        </span>
                        {authHeaders && (
                          <>
                            <button type="button" aria-label="Edit entry" onClick={() => { setDeleteEntry(null); setEditEntry({ date, reps: wr }) }} style={{ minWidth: 44, minHeight: 44, border: 'none', background: 'transparent', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✎</button>
                            <button type="button" aria-label="Delete entry" onClick={() => { setEditEntry(null); setDeleteEntry(date) }} style={{ minWidth: 44, minHeight: 44, border: 'none', background: 'transparent', color: '#ef4444', fontSize: 18, cursor: 'pointer' }}>🗑</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {isEditing && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center', marginTop: 10 }}>
                      <input type="number" inputMode="numeric" value={editEntry.reps} onChange={e => setEditEntry(prev => ({ ...prev, reps: e.target.value }))} style={{ minWidth: 0, fontSize: 16, fontWeight: 800, padding: '12px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }} />
                      <button type="button" onClick={handleSaveEntry} disabled={editSaving} style={{ minWidth: 44, minHeight: 44, border: 'none', borderRadius: 10, background: color, color: '#fff', fontWeight: 900, cursor: editSaving ? 'default' : 'pointer' }}>Save</button>
                      <button type="button" onClick={() => setEditEntry(null)} disabled={editSaving} style={{ minWidth: 44, minHeight: 44, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface2)', color: 'var(--muted)', fontWeight: 800, cursor: editSaving ? 'default' : 'pointer' }}>Cancel</button>
                    </div>
                  )}
                  {confirming && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                      <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 800, marginRight: 'auto' }}>Delete?</span>
                      <button type="button" onClick={() => handleDeleteEntry(date)} disabled={editSaving} style={{ minWidth: 44, minHeight: 44, border: 'none', borderRadius: 10, background: '#ef4444', color: '#fff', fontWeight: 900, cursor: editSaving ? 'default' : 'pointer' }}>Yes</button>
                      <button type="button" onClick={() => setDeleteEntry(null)} disabled={editSaving} style={{ minWidth: 44, minHeight: 44, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface2)', color: 'var(--muted)', fontWeight: 800, cursor: editSaving ? 'default' : 'pointer' }}>No</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {sessions > sessionLog.length && <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>Showing {sessionLog.length} of {sessions} sessions · scroll up for older entries</div>}
          <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right', marginTop: 6 }}>Log total: <span style={{ fontWeight: 700, color: 'var(--text)' }}>{isTimed ? fmtSeconds(sessionLog.reduce((s, e) => s + e.reps, 0)) : sessionLog.reduce((s, e) => s + e.reps, 0).toLocaleString()}</span>{sessions > sessionLog.length && <span style={{ color: '#e87020' }}> (partial)</span>}</div>
        </div>
      ) : (
        <div className="detail-section"><p className="detail-nil">No sets logged yet — go back and tap + to log your first {name.toLowerCase()}.</p></div>
      )}

    </div>
  )
}
