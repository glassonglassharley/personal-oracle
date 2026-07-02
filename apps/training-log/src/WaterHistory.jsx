import { useMemo, useState } from 'react'

const WATER_BLUE = '#22c55e'
const RANGES = [
  { key: '7D', label: '7D', days: 7 },
  { key: '30D', label: '30D', days: 30 },
  { key: '90D', label: '90D', days: 90 },
  { key: 'ALL', label: 'All', days: null },
]

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return localDateKey(d)
}

function fmtShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtLong(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function niceCups(value) {
  const n = Number(value || 0)
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '')
}

function buildWaterSeries(history = [], dayData = {}, rangeKey = '30D') {
  const today = localDateKey()
  const byDate = new Map()

  for (const row of history || []) {
    const cups = Number(row?.water || 0)
    if (row?.date && Number.isFinite(cups)) byDate.set(row.date, Math.max(0, cups))
  }

  const todayCups = Number(dayData?.water || 0)
  if (Number.isFinite(todayCups)) byDate.set(today, Math.max(0, todayCups))

  const range = RANGES.find(r => r.key === rangeKey) || RANGES[0]
  const datedKeys = [...byDate.keys()].filter(Boolean).sort()
  if (!datedKeys.length) return []

  const start = range.days
    ? addDays(today, -(range.days - 1))
    : datedKeys[0]

  const points = []
  let cursor = start
  while (cursor <= today) {
    points.push({ date: cursor, water: byDate.get(cursor) || 0 })
    cursor = addDays(cursor, 1)
  }
  return points
}

export default function WaterHistory({ history, dayData, goal = 8 }) {
  const [range, setRange] = useState('30D')
  const [selected, setSelected] = useState(null)
  const series = useMemo(() => buildWaterSeries(history, dayData, range), [history, dayData, range])
  const nonZero = series.filter(d => d.water > 0)
  const active = selected != null ? series[selected] : series[series.length - 1]
  const goalCups = Math.max(1, Number(goal || 8))
  const allTimeCups = useMemo(() => {
    const today = localDateKey()
    const byDate = new Map()
    for (const row of history || []) {
      const cups = Number(row?.water || 0)
      if (row?.date && Number.isFinite(cups)) byDate.set(row.date, Math.max(byDate.get(row.date) || 0, cups))
    }
    const todayCups = Number(dayData?.water || 0)
    if (Number.isFinite(todayCups)) byDate.set(today, Math.max(byDate.get(today) || 0, todayCups))
    return [...byDate.values()].reduce((s, v) => s + v, 0)
  }, [history, dayData])

  const total = nonZero.reduce((sum, d) => sum + d.water, 0)
  const avg = nonZero.length ? total / nonZero.length : 0
  const best = nonZero.length ? Math.max(...nonZero.map(d => d.water)) : 0

  const cardStyle = {
    background: 'var(--surface)', border: '1.5px solid var(--border)',
    borderRadius: 16, padding: 16, marginTop: 12,
  }
  const labelStyle = {
    fontSize: 10, color: 'var(--muted)', fontWeight: 800,
    letterSpacing: '0.5px', textTransform: 'uppercase',
  }

  if (!series.length || nonZero.length < 2) {
    return (
      <div style={cardStyle}>
        <div style={{ ...labelStyle, marginBottom: 8 }}>Water trend</div>
        <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.45 }}>
          Log water on at least two days to see your hydration trend.
        </div>
      </div>
    )
  }

  const W = Math.max(340, series.length * (range === '7D' ? 36 : range === '30D' ? 12 : range === '90D' ? 8 : 6))
  const H = 118
  const pL = 8, pR = 8, pT = 16, pB = 20
  const iW = W - pL - pR
  const iH = H - pT - pB
  const maxV = Math.max(best, goalCups, 1) * 1.08
  const cx = i => pL + (series.length > 1 ? (i / (series.length - 1)) * iW : iW / 2)
  const cy = v => pT + iH - (Math.min(maxV, v) / maxV) * iH
  const line = series.map((d, i) => `${i === 0 ? 'M' : 'L'}${cx(i).toFixed(1)},${cy(d.water).toFixed(1)}`).join(' ')
  const area = `${line} L${cx(series.length - 1).toFixed(1)},${pT + iH} L${cx(0).toFixed(1)},${pT + iH} Z`
  const goalY = cy(goalCups)

  return (
    <div style={cardStyle}>
      <style>{`.water-history-chart::-webkit-scrollbar{display:none;}`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={labelStyle}>Water trend</div>
          <div style={{ color: 'var(--text)', fontSize: 18, fontWeight: 900, marginTop: 3 }}>
            {active ? `${niceCups(active.water)} cups` : '—'}
          </div>
          {active && (
            <div style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 600, marginTop: 2 }}>
              {fmtLong(active.date)}{active.water >= goalCups ? <span style={{ color: WATER_BLUE, fontWeight: 800 }}> · Goal hit</span> : null}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          {RANGES.map(r => (
            <button
              key={r.key}
              type="button"
              onClick={() => { setRange(r.key); setSelected(null) }}
              style={{
                border: 'none', borderRadius: 9, padding: '7px 9px', cursor: 'pointer',
                background: range === r.key ? WATER_BLUE : 'var(--surface2)',
                color: range === r.key ? '#fff' : 'var(--muted)',
                fontSize: 11, fontWeight: 900,
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
        {[
          ['Avg', `${niceCups(avg)} cups`],
          ['Best', `${niceCups(best)} cups`],
          ['Goal', `${niceCups(goalCups)} cups`],
          ['All Time', `${niceCups(allTimeCups)} cups`],
        ].map(([label, value]) => (
          <div key={label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 6px', textAlign: 'center' }}>
            <div style={labelStyle}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text)', marginTop: 3 }}>{value}</div>
          </div>
        ))}
      </div>

      <div
        className="water-history-chart"
        style={{ overflowX: 'auto', overflowY: 'hidden', msOverflowStyle: 'none', scrollbarWidth: 'none', paddingBottom: 2 }}
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
          <defs>
            <linearGradient id="water-history-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={WATER_BLUE} stopOpacity="0.28" />
              <stop offset="100%" stopColor={WATER_BLUE} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1={pL} x2={W - pR} y1={goalY} y2={goalY} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
          <path d={area} fill="url(#water-history-fill)" />
          <path d={line} fill="none" stroke={WATER_BLUE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {series.map((d, i) => {
            const isActive = active && active.date === d.date
            const showPoint = d.water > 0 || isActive
            if (!showPoint) return null
            return (
              <circle
                key={d.date}
                cx={cx(i)} cy={cy(d.water)} r={isActive ? 4.2 : 2.5}
                fill={isActive ? '#fff' : WATER_BLUE}
                stroke={WATER_BLUE} strokeWidth={isActive ? 2.2 : 0}
                onClick={() => setSelected(i)}
                style={{ cursor: 'pointer' }}
              />
            )
          })}
          {series.map((d, i) => {
            const every = range === '7D' ? 1 : range === '30D' ? 7 : range === '90D' ? 14 : 30
            if (i !== 0 && i !== series.length - 1 && i % every !== 0) return null
            return (
              <text key={`label-${d.date}`} x={cx(i)} y={H - 4} textAnchor="middle" fill="var(--muted)" fontSize="9" fontWeight="700">
                {i === series.length - 1 ? 'Today' : fmtShort(d.date)}
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
