import { EX_NAMES } from './progressEngine.js'

const SIGNOFFS = [
  "Consistency is the game. You're winning.",
  "Every rep compounds. Keep stacking.",
  "Rest tomorrow. You earned it.",
  "Champions are made on days like this.",
  "Your future self will thank you.",
]

function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const BW_IDS = ['pushups', 'squats', 'situps', 'pullups', 'curls']

function buildChain(history, dayData, n = 14) {
  const today = localDate()
  const byDate = {}
  for (const d of history) byDate[d.date] = d
  byDate[today] = { ...(byDate[today] || {}), ...dayData }

  function dayType(d) {
    if (!d) return 'missed'
    if (d.rest === true) return 'rest'
    const bw = BW_IDS.reduce((s, id) => s + (typeof d[id] === 'number' ? d[id] : 0), 0)
    return bw + (d.bench?.reps || 0) > 0 ? 'active' : 'missed'
  }

  return Array.from({ length: n }, (_, i) => {
    const cur = new Date()
    cur.setDate(cur.getDate() - (n - 1 - i))
    const key = localDate(cur)
    return { key, type: dayType(byDate[key]), isToday: key === today }
  })
}

export default function WorkoutRecap({ recap, history, dayData, onClose }) {
  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const chain = buildChain(history, dayData)
  const signoff = SIGNOFFS[recap.streak % SIGNOFFS.length]

  const trendedExs = Object.entries(recap.trends)
    .filter(([, t]) => t !== null)
    .map(([id, trend]) => ({ name: EX_NAMES[id] || id, trend }))

  const DOT = { active: '#4ade80', rest: '#8b5cf6', missed: 'rgba(128,128,128,0.18)' }
  const TREND_ICON  = { up: '↑', flat: '→', down: '↓' }
  const TREND_COLOR = { up: '#4ade80', flat: 'var(--muted)', down: '#f87171' }

  const vol = recap.reps > 0
    ? { main: recap.reps.toLocaleString(), sub: 'reps today' }
    : { main: '—', sub: 'No data yet' }

  const card = {
    background: 'var(--surface2)',
    border: '1.5px solid var(--border)',
    borderRadius: 16,
    padding: '14px 16px',
    marginBottom: 12,
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 400, backdropFilter: 'blur(2px)',
        }}
      />
      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0,
          zIndex: 401,
          background: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          maxHeight: 'calc(100dvh - var(--safe-top) - 16px)',
          overflowY: 'auto',
          padding: '0 max(16px, var(--safe-right)) calc(40px + var(--safe-bottom)) max(16px, var(--safe-left))',
          animation: 'sheetUp 0.32s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px' }}>
          <div
            onClick={onClose}
            style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, cursor: 'pointer' }}
          />
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {todayStr}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>Today's Recap</div>
        </div>

        {/* Volume */}
        <div style={{ ...card, textAlign: 'center', background: 'linear-gradient(135deg, var(--surface2), var(--surface))' }}>
          <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-2px', lineHeight: 1 }}>{vol.main}</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6, fontWeight: 500 }}>{vol.sub}</div>
        </div>

        {/* PR banner */}
        {recap.prs.length > 0 && (
          <div style={{ background: 'linear-gradient(135deg, #92400e, #b45309)', borderRadius: 16, padding: '14px 16px', marginBottom: 12 }}>
            {recap.prs.map((pr, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < recap.prs.length - 1 ? 8 : 0 }}>
                <span style={{ fontSize: 22 }}>🏆</span>
                <div>
                  <div style={{ fontSize: 12, color: '#fde68a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>New personal record</div>
                  <div style={{ fontSize: 15, color: '#fff', fontWeight: 700 }}>{pr.exercise}: {pr.display}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Week vs last week */}
        {recap.weeklyVol.changePercent !== null && (
          <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>vs last week</span>
            <span style={{
              fontSize: 20, fontWeight: 800,
              color: recap.weeklyVol.changePercent >= 0 ? '#4ade80' : '#f87171',
            }}>
              {recap.weeklyVol.changePercent >= 0 ? '↑' : '↓'} {Math.abs(recap.weeklyVol.changePercent)}%
            </span>
          </div>
        )}

        {/* Streak chain */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>🔥</span>
            <span style={{ fontSize: 18, fontWeight: 800 }}>{recap.streak} day streak</span>
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {chain.map(day => (
              <div
                key={day.key}
                title={`${day.key}${day.type === 'rest' ? ' (rest)' : ''}`}
                style={{
                  flex: 1,
                  height: day.isToday ? 22 : 14,
                  borderRadius: 4,
                  background: DOT[day.type],
                  border: day.isToday ? '2px solid var(--accent)' : 'none',
                  alignSelf: 'flex-end',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>14 days ago</span>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>today</span>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11, color: 'var(--muted)' }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: DOT.active, marginRight: 4 }} />Active</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: DOT.rest, marginRight: 4 }} />Rest</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: DOT.missed, marginRight: 4 }} />Missed</span>
          </div>
        </div>

        {/* Trending exercises */}
        {trendedExs.length > 0 && (
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
              Trends
            </div>
            {trendedExs.map(({ name, trend }) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{name}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: TREND_COLOR[trend] }}>{TREND_ICON[trend]}</span>
              </div>
            ))}
          </div>
        )}

        {/* Sign-off */}
        <div style={{ textAlign: 'center', padding: '14px 8px', fontSize: 15, fontWeight: 600, color: 'var(--muted)', fontStyle: 'italic' }}>
          "{signoff}"
        </div>

        <button className="btn-primary" onClick={onClose} style={{ width: '100%', marginTop: 4 }}>
          Close
        </button>
      </div>
    </>
  )
}
