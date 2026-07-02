import { useState, useEffect, useMemo, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { HealthBridge } from '../lib/health.js'

const API = import.meta.env.VITE_API_URL || ''

const RANGES = [
  { key: '7D',  label: '7D',  days: 7,    group: 'day'   },
  { key: '1M',  label: '1M',  days: 30,   group: 'day'   },
  { key: '6M',  label: '6M',  days: 180,  group: 'week'  },
  { key: '1Y',  label: '1Y',  days: 365,  group: 'week'  },
  { key: '5Y',  label: '5Y',  days: 1825, group: 'month' },
]

function daysAgo(n) {
  return addDays(localDateKey(), -n)
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return localDateKey(d)
}

function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return localDateKey(d)
}

function computeBars(history, rangeKey) {
  const range = RANGES.find(r => r.key === rangeKey)
  if (!range || !history.length) return []
  const cutoff = daysAgo(range.days - 1)
  const today = localDateKey()
  const filtered = history.filter(d => d.date >= cutoff && d.date <= today)

  if (range.group === 'day') {
    // Confirmed root cause of the reported 1M mismatch: the underlying API
    // already returns one de-duplicated value per date by taking the max of
    // Google/native synced daily_steps and manually saved training_logs.steps;
    // the visible mismatch was this card's rounded K-label. Keep 1M Total
    // derived from this exact bars array so it can never diverge from the
    // rendered daily bars, even if duplicate date rows are ever introduced.
    const byDate = new Map(filtered.map(d => [d.date, d.steps]))
    const bars = []
    const d = new Date(cutoff + 'T12:00:00')
    const end = new Date(today + 'T12:00:00')
    while (d <= end) {
      const key = localDateKey(d)
      bars.push({ date: key, steps: byDate.get(key) || 0 })
      d.setDate(d.getDate() + 1)
    }
    return bars
  }

  if (range.group === 'week') {
    const byWeek = new Map()
    for (const d of filtered) {
      const wk = getWeekStart(d.date)
      byWeek.set(wk, (byWeek.get(wk) || 0) + d.steps)
    }
    return [...byWeek.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, steps]) => ({ date, steps }))
  }

  // month
  const byMonth = new Map()
  for (const d of filtered) {
    const mo = d.date.slice(0, 7)
    byMonth.set(mo, (byMonth.get(mo) || 0) + d.steps)
  }
  return [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mo, steps]) => ({ date: mo + '-01', steps }))
}

function computeStats(bars) {
  const nonZero = bars.filter(b => b.steps > 0)
  if (!nonZero.length) return { avg: 0, best: 0, total: 0 }
  const total = bars.reduce((s, b) => s + b.steps, 0)
  return {
    avg:   Math.round(total / nonZero.length),
    best:  Math.max(...bars.map(b => b.steps)),
    total,
  }
}

function fmtLabel(dateStr, group, index, bars) {
  const d = new Date(dateStr + 'T12:00:00')
  if (group === 'day') {
    if (bars.length <= 7) return d.toLocaleDateString('en-US', { weekday: 'narrow' })
    return index % 7 === 0 ? d.getDate().toString() : ''
  }
  if (group === 'week') {
    const prevMo = index > 0 ? bars[index - 1].date.slice(0, 7) : null
    const currMo = dateStr.slice(0, 7)
    return currMo !== prevMo ? d.toLocaleDateString('en-US', { month: 'short' }) : ''
  }
  // month
  const prevYr = index > 0 ? bars[index - 1].date.slice(0, 4) : null
  const currYr = dateStr.slice(0, 4)
  return currYr !== prevYr ? d.getFullYear().toString() : ''
}

function fmtDate(dateStr, group) {
  const d = new Date(dateStr + 'T12:00:00')
  if (group === 'day')   return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  if (group === 'week')  return `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function fmtLargeNum(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000)    return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}

export default function StepsHistory({ authHeaders, stepGoal = 10000, dayData }) {
  const [history, setHistory]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [syncing, setSyncing]   = useState(false)
  const [syncMsg, setSyncMsg]   = useState('')
  const [range, setRange]       = useState('1M')
  const [selected, setSelected] = useState(null)
  const chartRef = useRef(null)
  const isNative = Capacitor.isNativePlatform()

  useEffect(() => { init() }, [])

  async function init() {
    await loadHistory()
    // Auto-backfill on first open so history populates without manual tap
    await syncHistory(true)
  }

  useEffect(() => {
    setSelected(null)
    setTimeout(() => {
      if (chartRef.current) chartRef.current.scrollLeft = chartRef.current.scrollWidth
    }, 60)
  }, [range, history.length])

  async function loadHistory() {
    setLoading(true)
    try {
      const hdrs = await authHeaders()
      const res  = await fetch(`${API}/api/health-metrics?metric=steps&history=1`, { headers: hdrs })
      if (res.ok) {
        const data = await res.json()
        let rows = data.history || []
        rows = [...rows.reduce((byDate, row) => {
          const date = String(row?.date || '')
          const steps = Math.max(0, Math.floor(Number(row?.steps) || 0))
          if (date) byDate.set(date, Math.max(byDate.get(date) || 0, steps))
          return byDate
        }, new Map()).entries()].map(([date, steps]) => ({ date, steps }))
        // Merge today's live steps if newer
        const today = localDateKey()
        const live  = Number(dayData?.steps || 0)
        if (live > 0) {
          const existing = rows.find(r => r.date === today)
          if (!existing) rows = [...rows, { date: today, steps: live }]
          else if (live > existing.steps) rows = rows.map(r => r.date === today ? { ...r, steps: live } : r)
        }
        setHistory(rows.sort((a, b) => a.date.localeCompare(b.date)))
      }
    } catch {}
    setLoading(false)
  }

  async function syncHistory(silent = false) {
    if (!silent) setSyncing(true)
    setSyncMsg('')
    try {
      if (isNative) {
        const platform = Capacitor.getPlatform()
        await HealthBridge.requestPermissions()
        const hist   = await HealthBridge.getHistorySteps(365)
        if (!hist.length) { if (!silent) setSyncMsg('No step data found'); return }
        const hdrs   = await authHeaders()
        const source = platform === 'ios' ? 'healthkit' : 'health_connect'
        await Promise.all(hist.map(d =>
          fetch(`${API}/api/health-metrics?metric=steps`, {
            method: 'POST',
            headers: { ...hdrs, 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: d.date, steps: d.steps, source }),
          }).catch(() => {})
        ))
        if (!silent) setSyncMsg(`Synced ${hist.length} days`)
        await loadHistory()
      } else {
        const hdrs = await authHeaders()
        const res  = await fetch(`${API}/api/google/backfill`, {
          method: 'POST',
          headers: { ...hdrs, 'Content-Type': 'application/json' },
          body: JSON.stringify({ days: 365 }),
        })
        const data = await res.json()
        if (data.ok) {
          if (!silent) setSyncMsg(`Synced ${data.synced} days`)
          await loadHistory()
        }
      }
    } catch {
      if (!silent) setSyncMsg('Sync failed — try again')
    } finally {
      if (!silent) setSyncing(false)
    }
  }

  const rangeConfig = RANGES.find(r => r.key === range)
  const bars        = useMemo(() => computeBars(history, range), [history, range])
  const stats       = useMemo(() => computeStats(bars), [bars])
  const activeIdx   = selected ?? bars.length - 1
  const activeBar   = bars[activeIdx]

  const maxSteps = Math.max(...bars.map(b => b.steps), stepGoal * 0.5, 1)
  const CHART_H  = 110
  const barW     = range === '7D' ? 34 : range === '1M' ? 16 : range === '6M' ? 12 : range === '1Y' ? 9 : 9
  const barGap   = range === '7D' ? 6 : 3

  const statPeriod = rangeConfig?.group === 'week' ? '/wk' : rangeConfig?.group === 'month' ? '/mo' : '/day'

  return (
    <div>
      <style>{`
        .steps-chart::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Range tabs + compact sync */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 16, alignItems: 'center' }}>
        {RANGES.map(r => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 10, border: 'none',
              background: range === r.key ? 'var(--accent)' : 'var(--surface)',
              color: range === r.key ? '#fff' : 'var(--muted)',
              fontSize: 12, fontWeight: 800, cursor: 'pointer',
            }}
          >
            {r.label}
          </button>
        ))}
        <button
          onClick={() => syncHistory()}
          disabled={syncing}
          title="Sync 1 year of history"
          style={{
            flexShrink: 0, width: 30, height: 30, borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: syncing ? 'var(--muted)' : 'var(--text)',
            fontSize: 13, cursor: syncing ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: syncing ? 0.5 : 1, padding: 0,
          }}
        >
          {syncing ? '⟳' : '↓'}
        </button>
      </div>

      {/* Active bar callout */}
      <div style={{ minHeight: 48, marginBottom: 6 }}>
        {!loading && activeBar ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-1.5px', color: 'var(--text)', lineHeight: 1 }}>
                {activeBar.steps.toLocaleString()}
              </span>
              <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>steps</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
              {fmtDate(activeBar.date, rangeConfig?.group)}
              {activeBar.steps >= stepGoal && (
                <span style={{ color: 'var(--success)', fontWeight: 700, marginLeft: 6 }}>✓ Goal</span>
              )}
            </div>
          </>
        ) : loading ? (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
        ) : null}
      </div>

      {/* Bar chart */}
      <div
        ref={chartRef}
        className="steps-chart"
        style={{
          overflowX: 'auto', overflowY: 'hidden',
          msOverflowStyle: 'none', scrollbarWidth: 'none',
          marginBottom: 14, paddingBottom: 2,
        }}
      >
        {!loading && bars.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
            No data yet — tap Sync to load history
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: barGap,
            height: CHART_H + 18, paddingTop: 4, position: 'relative',
            minWidth: bars.length * (barW + barGap),
          }}>
            {/* Goal line */}
            {bars.length > 0 && (
              <div style={{
                position: 'absolute', left: 0, right: 0,
                bottom: 18 + Math.round(CHART_H * (stepGoal / maxSteps)),
                borderTop: '1px dashed var(--border)',
                opacity: 0.5, pointerEvents: 'none',
              }} />
            )}

            {bars.map((bar, i) => {
              const isActive = i === activeIdx
              const hitGoal  = bar.steps >= stepGoal
              const pct      = bar.steps / maxSteps
              const barH     = Math.max(pct > 0 ? 3 : 1, Math.round(pct * CHART_H))
              const label    = fmtLabel(bar.date, rangeConfig?.group, i, bars)

              return (
                <div
                  key={bar.date}
                  onClick={() => setSelected(i === selected ? null : i)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'flex-end', gap: 3,
                    width: barW, flexShrink: 0, cursor: 'pointer', height: CHART_H + 18,
                  }}
                >
                  <div style={{
                    width: '100%', height: barH, borderRadius: 999,
                    background: hitGoal
                      ? 'var(--success)'
                      : isActive
                        ? 'var(--accent)'
                        : 'rgba(128,128,128,0.22)',
                    opacity: isActive ? 1 : 0.8,
                    transition: 'height 0.2s ease',
                  }} />
                  <div style={{
                    fontSize: 8, color: isActive ? 'var(--text)' : 'var(--muted)',
                    fontWeight: 700, height: 10, textAlign: 'center',
                    lineHeight: 1, whiteSpace: 'nowrap',
                  }}>
                    {label}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Stats row */}
      {!loading && bars.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { label: `Avg${statPeriod}`, val: stats.avg.toLocaleString() },
            { label: 'Best',             val: stats.best.toLocaleString() },
            // Root cause: the 1M bars already use one exact daily value per
            // calendar date, but this summary abbreviated totals to rounded K
            // values. Showing the exact sum keeps Total equal to the dailies.
            { label: 'Total',            val: stats.total.toLocaleString() },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--surface)', borderRadius: 12,
              padding: '10px 12px', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 3 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px' }}>
                {s.val}
              </div>
            </div>
          ))}
        </div>
      )}

      {syncMsg && (
        <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginBottom: 8 }}>
          {syncMsg}
        </div>
      )}

      {/* All-time totals */}
      {!loading && history.length > 0 && (() => {
        const allSteps = history.reduce((s, d) => s + d.steps, 0)
        const allMiles = (allSteps / 2000).toFixed(1)
        return (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>All Time</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Total Steps', val: fmtLargeNum(allSteps) },
                { label: 'Total Miles', val: `${allMiles} mi` },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'var(--surface)', borderRadius: 12,
                  padding: '10px 12px', border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 3 }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px' }}>
                    {s.val}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
