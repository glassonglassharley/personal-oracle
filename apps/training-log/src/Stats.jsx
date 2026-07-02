import { useState, useMemo } from 'react'
import { normalizeMeals } from './Meals.jsx'

// ── Helpers ───────────────────────────────────────────────────────────────────

function exVal(day, id, type) {
  const v = day[id]
  if (type === 'bench') return (v?.weight || 0) * (v?.reps || 0)
  if (Array.isArray(v)) return v.length
  return typeof v === 'number' ? v : 0
}

function weekDates(offset = 0) {
  const now = new Date()
  const dow = now.getDay() || 7 // Mon=1 … Sun=7
  const mon = new Date(now)
  mon.setDate(now.getDate() - (dow - 1) + offset * 7)
  mon.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

function sumWeek(history, dates, id, type) {
  return history
    .filter(d => dates.includes(d.date))
    .reduce((s, d) => s + exVal(d, id, type), 0)
}

function calcStreak(history, id, type) {
  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date))
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

function calcAllTime(history, id, type) {
  return history.reduce((s, d) => s + exVal(d, id, type), 0)
}

function calcAvgActive(history, id, type) {
  const active = history.filter(d => exVal(d, id, type) > 0)
  if (!active.length) return 0
  return Math.round(calcAllTime(active, id, type) / active.length)
}

// ── SVG Line Chart ────────────────────────────────────────────────────────────

function LineChart({ points, goal, color }) {
  if (points.length === 0) return <div className="chart-empty">No data yet</div>

  const W = 300, H = 72
  const pL = 2, pR = 6, pT = 8, pB = 4
  const iW = W - pL - pR, iH = H - pT - pB

  const vals = points.map(p => p.value)
  const maxVal = Math.max(goal || 0, ...vals, 1)

  const cx = i => pL + (points.length > 1 ? (i / (points.length - 1)) * iW : iW / 2)
  const cy = v => pT + iH - (v / maxVal) * iH

  const prI  = vals.reduce((mi, v, i) => v >= vals[mi] ? i : mi, 0)
  const goalY = goal ? cy(goal) : null

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${cx(i).toFixed(1)},${cy(p.value).toFixed(1)}`).join('')
  const areaPath = linePath
    + ` L${cx(points.length - 1).toFixed(1)},${(pT + iH)}`
    + ` L${pL},${pT + iH} Z`

  const gradId = `g${color.replace('#', '')}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="line-chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      {goalY != null && (
        <line x1={pL} y1={goalY.toFixed(1)} x2={W - pR} y2={goalY.toFixed(1)}
          stroke="rgba(255,255,255,0.22)" strokeWidth="1" strokeDasharray="4 3" />
      )}
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.8"
        strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={cx(prI).toFixed(1)} cy={cy(vals[prI]).toFixed(1)}
        r="3.5" fill="#FFD700" />
    </svg>
  )
}

// ── Weekly Summary ────────────────────────────────────────────────────────────

function WeeklySummary({ history, weekOffset, onPrev, onNext, allDefs, goals }) {
  const thisDates = weekDates(weekOffset)
  const prevDates = weekDates(weekOffset - 1)
  const weekLabel = new Date(thisDates[0] + 'T00:00:00')
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const rows = allDefs.map(def => {
    const tw = sumWeek(history, thisDates, def.id, def.type)
    const pw = sumWeek(history, prevDates, def.id, def.type)
    if (tw === 0 && pw === 0) return null
    const maxBar = Math.max(tw, pw, 1)
    const change = pw > 0 ? Math.round(((tw - pw) / pw) * 100) : null
    return { def, tw, pw, maxBar, change }
  }).filter(Boolean)

  return (
    <section className="stats-section">
      <div className="stats-sec-hd">
        <h2>Weekly Summary</h2>
        <div className="week-nav">
          <button className="week-btn" onClick={onPrev}>‹</button>
          <span className="week-label">Week of {weekLabel}</span>
          <button className="week-btn" onClick={onNext} disabled={weekOffset >= 0}>›</button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="stats-nil">No activity this week.</p>
      ) : (
        <div className="weekly-rows">
          {rows.map(({ def, tw, pw, maxBar, change }) => (
            <div key={def.id} className="wr">
              <span className="wr-name">{def.name}</span>
              <div className="wr-bars">
                <div className="wr-bar-row">
                  <div className="wr-fill" style={{ width: `${(tw / maxBar) * 100}%`, background: def.color }} />
                  <span className="wr-num">{tw.toLocaleString()}</span>
                </div>
                <div className="wr-bar-row">
                  <div className="wr-fill" style={{ width: `${(pw / maxBar) * 100}%`, background: 'var(--border)' }} />
                  <span className="wr-num muted">{pw.toLocaleString()}</span>
                </div>
              </div>
              {change !== null && (
                <span className={`wr-change ${change >= 0 ? 'up' : 'dn'}`}>
                  {change >= 0 ? '▲' : '▼'}{Math.abs(change)}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ── Growth Charts ─────────────────────────────────────────────────────────────

function GrowthCharts({ history, goals, allDefs }) {
  const chrono = useMemo(
    () => [...history].sort((a, b) => a.date.localeCompare(b.date)).slice(-30),
    [history]
  )

  const charts = allDefs.map(def => {
    const points = chrono
      .map(d => ({ date: d.date, value: exVal(d, def.id, def.type) }))
      .filter(p => p.value > 0)
    if (points.length === 0) return null

    const goal     = def.type !== 'bench' ? (goals?.[def.id] || null) : null
    const allTime  = calcAllTime(history, def.id, def.type)
    const pr       = calcPR(history, def.id, def.type)
    const streak   = calcStreak(history, def.id, def.type)
    const avg      = calcAvgActive(history, def.id, def.type)
    return { def, points, goal, allTime, pr, streak, avg }
  }).filter(Boolean)

  return (
    <section className="stats-section">
      <div className="stats-sec-hd"><h2>Growth Charts</h2></div>
      {charts.length === 0 ? (
        <p className="stats-nil">Log a few days to see charts.</p>
      ) : (
        <div className="charts-stack">
          {charts.map(({ def, points, goal, allTime, pr, streak, avg }) => (
            <div key={def.id} className="chart-card">
              <div className="chart-hd">
                <span className="chart-name" style={{ color: def.color }}>{def.name}</span>
                {def.type === 'bench' && <span className="muted chart-unit">lb×rep vol</span>}
                {goal && <span className="chart-goal-badge" style={{ borderColor: def.color, color: def.color }}>goal {goal.toLocaleString()}</span>}
              </div>
              <LineChart points={points} goal={goal} color={def.color} />
              <div className="chart-mini">
                <div className="cm"><span className="cm-v">{allTime.toLocaleString()}</span><span className="cm-l">all-time</span></div>
                <div className="cm"><span className="cm-v gold">{pr.toLocaleString()}</span><span className="cm-l">best day</span></div>
                <div className="cm"><span className="cm-v" style={{ color: def.color }}>{streak}</span><span className="cm-l">streak</span></div>
                <div className="cm"><span className="cm-v">{avg.toLocaleString()}</span><span className="cm-l">avg/day</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ── Historical Totals ─────────────────────────────────────────────────────────

function HistoricalTotals({ history }) {
  const t = useMemo(() => history.reduce((a, d) => {
    a.pushups += d.pushups || 0
    a.squats  += d.squats  || 0
    a.situps  += d.situps  || 0
    a.pullups += d.pullups || 0
    a.curls   += d.curls   || 0
    a.bench   += (d.bench?.reps > 0) ? 1 : 0
    a.steps   += d.steps   || 0
    a.meals   += Array.isArray(d.meals) ? d.meals.length : (d.meals || 0)
    return a
  }, { pushups: 0, squats: 0, situps: 0, pullups: 0, curls: 0, bench: 0, steps: 0, meals: 0 }), [history])

  const miles = Math.round(t.steps / 2000)

  const rows = [
    { label: 'Push-ups',       val: t.pushups, color: '#4A90D9', extra: null,
      ms: t.pushups >= 10000 ? '10,000 club!' : t.pushups >= 1000 ? 'Over 1,000!' : null },
    { label: 'Squats',         val: t.squats,  color: '#27AE60', extra: null,
      ms: t.squats >= 1000 ? 'Over 1,000!' : null },
    { label: 'Sit-ups',        val: t.situps,  color: '#E8A020', extra: null,
      ms: t.situps >= 1000 ? 'Over 1,000!' : null },
    { label: 'Pull-ups',       val: t.pullups, color: '#C0392B', extra: null,
      ms: t.pullups >= 500 ? 'Over 500!' : null },
    { label: 'Curls',          val: t.curls,   color: '#7B3FA0', extra: null,
      ms: t.curls >= 1000 ? 'Over 1,000!' : null },
    { label: 'Bench Sessions', val: t.bench,   color: '#C25E1A', extra: null,
      ms: t.bench >= 100 ? '100 sessions!' : null },
    { label: 'Steps',          val: t.steps,   color: '#6B7280', extra: `${miles.toLocaleString()} mi`,
      ms: miles >= 100 ? '100 miles!' : miles >= 26 ? 'Marathon distance!' : null },
    { label: 'Meals Logged',   val: t.meals,   color: '#14B8A6', extra: null, ms: null },
  ]

  return (
    <section className="stats-section">
      <div className="stats-sec-hd"><h2>Historical Totals</h2></div>
      <div className="totals-grid">
        {rows.map(row => (
          <div key={row.label} className="total-card">
            <span className="total-label">{row.label}</span>
            <span className="total-val" style={{ color: row.color }}>{row.val.toLocaleString()}</span>
            {row.extra    && <span className="total-extra">{row.extra}</span>}
            {row.ms       && <span className="total-ms">{row.ms}</span>}
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Nutrition Stats ───────────────────────────────────────────────────────────

function NutritionStats({ history }) {
  const thisWeek = weekDates(0)
  const lastWeek = weekDates(-1)

  function weekMeals(dates) {
    return history.filter(d => dates.includes(d.date)).flatMap(d => normalizeMeals(d.meals))
  }

  function weekAvg(dates, field) {
    const meals = weekMeals(dates)
    if (!meals.length) return 0
    return Math.round(meals.reduce((s, m) => s + (m[field] || 0), 0) / 7)
  }

  const thisCalAvg = weekAvg(thisWeek, 'calories')
  const lastCalAvg = weekAvg(lastWeek, 'calories')
  const thisPrAvg  = weekAvg(thisWeek, 'protein')
  const lastPrAvg  = weekAvg(lastWeek, 'protein')

  const thisWeekMeals = weekMeals(thisWeek)
  const qCounts = thisWeekMeals.reduce((a, m) => {
    if (m.quality) a[m.quality] = (a[m.quality] || 0) + 1
    return a
  }, {})
  const totalTagged = (qCounts.clean || 0) + (qCounts.okay || 0) + (qCounts.cheat || 0)

  const textFreq = {}
  history.forEach(d => normalizeMeals(d.meals).forEach(m => {
    if (m.text) { const k = m.text.toLowerCase().trim(); textFreq[k] = (textFreq[k] || 0) + 1 }
  }))
  const top3 = Object.entries(textFreq).sort((a, b) => b[1] - a[1]).slice(0, 3)

  if (thisCalAvg === 0 && lastCalAvg === 0 && thisWeekMeals.length === 0) return null

  const maxBar = Math.max(thisCalAvg, lastCalAvg, 1)
  const maxPr  = Math.max(thisPrAvg, lastPrAvg, 1)

  return (
    <section className="stats-section">
      <div className="stats-sec-hd"><h2>Nutrition</h2></div>

      {/* Calorie comparison */}
      {(thisCalAvg > 0 || lastCalAvg > 0) && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>AVG DAILY CALORIES</div>
          <div className="wr">
            <span className="wr-name">This week</span>
            <div className="wr-bars">
              <div className="wr-bar-row">
                <div className="wr-fill" style={{ width: `${(thisCalAvg/maxBar)*100}%`, background: '#f59e0b' }} />
                <span className="wr-num">{thisCalAvg.toLocaleString()}</span>
              </div>
              <div className="wr-bar-row">
                <div className="wr-fill" style={{ width: `${(lastCalAvg/maxBar)*100}%`, background: 'var(--border)' }} />
                <span className="wr-num muted">{lastCalAvg.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="wr" style={{ marginTop: 8 }}>
            <span className="wr-name">Protein (g)</span>
            <div className="wr-bars">
              <div className="wr-bar-row">
                <div className="wr-fill" style={{ width: `${(thisPrAvg/maxPr)*100}%`, background: '#4A90D9' }} />
                <span className="wr-num">{thisPrAvg}</span>
              </div>
              <div className="wr-bar-row">
                <div className="wr-fill" style={{ width: `${(lastPrAvg/maxPr)*100}%`, background: 'var(--border)' }} />
                <span className="wr-num muted">{lastPrAvg}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quality breakdown */}
      {totalTagged > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>
            MEAL QUALITY · {totalTagged} tagged this week
          </div>
          <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', gap: 0 }}>
            {[['clean','#22c55e'],['okay','#f59e0b'],['cheat','#ef4444']].map(([q, c]) => {
              const pct = totalTagged > 0 ? ((qCounts[q] || 0) / totalTagged) * 100 : 0
              return pct > 0 ? <div key={q} style={{ width: `${pct}%`, background: c }} /> : null
            })}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
            {[['clean','#22c55e'],['okay','#f59e0b'],['cheat','#ef4444']].map(([q, c]) =>
              (qCounts[q] || 0) > 0 ? (
                <span key={q} style={{ color: c, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
                  {qCounts[q]} {q}
                </span>
              ) : null
            )}
          </div>
        </div>
      )}

      {/* Top meals */}
      {top3.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>TOP MEALS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {top3.map(([text, count]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{text}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', flexShrink: 0 }}>{count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

// ── Stats Screen ──────────────────────────────────────────────────────────────

const STAT_DEFS = [
  { id: 'pushups', name: 'Push-ups',    color: '#4A90D9', type: 'reps'  },
  { id: 'squats',  name: 'Squats',      color: '#27AE60', type: 'reps'  },
  { id: 'situps',  name: 'Sit-ups',     color: '#E8A020', type: 'reps'  },
  { id: 'pullups', name: 'Pull-ups',    color: '#C0392B', type: 'reps'  },
  { id: 'curls',   name: 'Curls',       color: '#7B3FA0', type: 'reps'  },
  { id: 'bench',   name: 'Bench Press', color: '#C25E1A', type: 'bench' },
  { id: 'steps',   name: 'Steps',       color: '#6B7280', type: 'reps'  },
  { id: 'meals',   name: 'Meals',       color: '#14B8A6', type: 'reps'  },
]

export default function Stats({ history, goals, customExercises }) {
  const [weekOffset, setWeekOffset] = useState(0)

  const allDefs = useMemo(() => [
    ...STAT_DEFS,
    ...customExercises.map(e => ({ id: e.id, name: e.name, color: e.color, type: e.type })),
  ], [customExercises])

  if (history.length === 0) {
    return (
      <div className="stats-empty-state">
        <p>No data yet.</p>
        <p className="muted">Log workouts to see your stats here.</p>
      </div>
    )
  }

  return (
    <div className="stats-screen">
      <WeeklySummary
        history={history}
        weekOffset={weekOffset}
        onPrev={() => setWeekOffset(o => o - 1)}
        onNext={() => setWeekOffset(o => Math.min(0, o + 1))}
        allDefs={allDefs}
        goals={goals}
      />
      <NutritionStats history={history} />
      <GrowthCharts history={history} goals={goals} allDefs={allDefs} />
      <HistoricalTotals history={history} />
    </div>
  )
}
