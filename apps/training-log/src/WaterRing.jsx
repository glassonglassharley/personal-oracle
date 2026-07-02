const CUPS_PER_BOTTLE = 16.9 / 8

function bottleLabel(cups) {
  const bottles = cups / CUPS_PER_BOTTLE
  if (!Number.isFinite(bottles) || bottles <= 0) return '0 bottles'
  return `${bottles.toFixed(bottles < 10 ? 1 : 0)} bottles`
}

export default function WaterRing({ water, goal, onChange, compact = false }) {
  const count  = Math.min(Math.max(goal || 8, 4), 16)
  const actual = water || 0
  const filled = Math.min(actual, count)
  const pct    = count > 0 ? filled / count : 0

  const size   = 108
  const stroke = 10
  const r      = (size - stroke) / 2
  const circ   = 2 * Math.PI * r
  const dash   = circ * pct

  if (compact) {
    return (
      <div style={{
        background: 'var(--surface)', border: '1.5px solid var(--border)',
        borderRadius: 16, padding: '14px 10px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      }}>
        <div style={{ fontSize: 20, lineHeight: 1 }}>💧</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', lineHeight: 1, letterSpacing: '-1px' }}>{actual}</div>
        <div style={{ width: '100%', height: 4, borderRadius: 999, background: 'rgba(43,93,168,0.15)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.round(pct * 100)}%`, background: '#2B5DA8', borderRadius: 999, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, color: actual >= count ? '#2B5DA8' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          {actual >= count ? `${actual} cups ✓` : `${actual} / ${count} cups`}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--surface)', border: '1.5px solid var(--border)',
      borderRadius: 16, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      {/* SVG ring */}
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="#2B5DA8" strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.35s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{actual}</span>
          <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>/ {count}</span>
          <span style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 1 }}>cups</span>
        </div>
      </div>

      {/* Glass taps */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Hydration</span>
          {actual >= count && (
            <span style={{ fontSize: 11, color: '#2B5DA8', fontWeight: 700 }}>{actual} cups ✓</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {Array.from({ length: Math.max(count, actual) }, (_, i) => {
            const on = i < actual
            const overGoal = i >= count
            return (
              <button
                key={i}
                onClick={() => onChange(actual === i + 1 ? i : i + 1)}
                style={{
                  width: 26, height: 26, borderRadius: 7, padding: 0,
                  background: on ? (overGoal ? 'rgba(43,93,168,0.07)' : 'rgba(43,93,168,0.15)') : 'var(--surface2)',
                  border: `1.5px solid ${on ? '#2B5DA8' : overGoal ? 'rgba(43,93,168,0.3)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s, border-color 0.15s',
                  opacity: overGoal ? 0.7 : 1,
                }}
              >
                {on
                  ? <span style={{ display: 'block', width: 8, height: 8, borderRadius: '50%', background: '#2B5DA8' }} />
                  : <span style={{ color: 'var(--border)', fontSize: 11, lineHeight: 1 }}>○</span>}
              </button>
            )
          })}
          <button
            onClick={() => onChange(actual + 1)}
            style={{
              width: 26, height: 26, borderRadius: 7, padding: 0,
              background: 'var(--surface2)',
              border: '1.5px dashed var(--border)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: 'var(--muted)', fontWeight: 700,
            }}
            title="Add one more glass"
          >+</button>
        </div>
        <div style={{
          marginTop: 12, padding: '10px 12px', borderRadius: 12,
          background: 'color-mix(in srgb, #2B5DA8 7%, var(--surface2))',
          border: '1px solid color-mix(in srgb, #2B5DA8 18%, var(--border))',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Bottle math
              </div>
              <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 800, marginTop: 2 }}>
                16.9 oz bottle ≈ 2.1 cups
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--muted)', fontWeight: 700, lineHeight: 1.35 }}>
              Logged<br />{bottleLabel(filled)}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            {[
              ['1 bottle', '2.1 cups', 1],
              ['2 bottles', '4.2 cups', 2],
              ['4 bottles', '8.5 cups', 4],
            ].map(([label, value, bottles]) => (
              <button
                key={label}
                type="button"
                onClick={() => onChange(actual + Math.round(bottles * CUPS_PER_BOTTLE * 10) / 10)}
                style={{
                  borderRadius: 9, padding: '6px 4px', textAlign: 'center',
                  background: 'rgba(43,93,168,0.08)', border: '1px solid rgba(43,93,168,0.12)',
                  cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
                }}
                title={`Log ${value} of water`}
              >
                <div style={{ fontSize: 10, color: '#2B5DA8', fontWeight: 900 }}>{label}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, marginTop: 1 }}>{value}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
