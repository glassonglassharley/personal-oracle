import { useId, useState, useRef, useEffect } from 'react'
import { computeChartHeader } from './robinhoodChartMath.js'

// ── Constants ──────────────────────────────────────────────────────────────────

const RANGE_DAYS = { '1D': 2, '1W': 7, '1M': 30, '1Y': 365, '5Y': 1825 }
const W = 340, H = 146
const PAD_T = 44, PAD_B = 2

const STARS = [
  // Top band cy 2–10: 8 stars spread evenly across full width
  { cx: 18,  cy: 5,   r: 1.0, op: 0.42 },
  { cx: 62,  cy: 3,   r: 0.8, op: 0.36, twinkle: true, delay: 1.2 },
  { cx: 108, cy: 8,   r: 0.9, op: 0.40 },
  { cx: 158, cy: 4,   r: 1.1, op: 0.46 },
  { cx: 205, cy: 7,   r: 0.8, op: 0.36, twinkle: true, delay: 3.5 },
  { cx: 250, cy: 3,   r: 1.0, op: 0.42 },
  { cx: 295, cy: 8,   r: 0.8, op: 0.34 },
  { cx: 330, cy: 5,   r: 1.0, op: 0.44, twinkle: true, delay: 0.7 },
  // Upper-mid band cy 12–20
  { cx: 40,  cy: 15,  r: 0.8, op: 0.30 },
  { cx: 118, cy: 18,  r: 0.9, op: 0.32 },
  { cx: 195, cy: 14,  r: 0.7, op: 0.28, twinkle: true, delay: 2.4 },
  { cx: 268, cy: 19,  r: 1.0, op: 0.34 },
  { cx: 325, cy: 13,  r: 0.8, op: 0.30 },
  // Mid band cy 22–32
  { cx: 22,  cy: 28,  r: 0.8, op: 0.28 },
  { cx: 95,  cy: 25,  r: 0.7, op: 0.26, twinkle: true, delay: 4.5 },
  { cx: 170, cy: 30,  r: 0.9, op: 0.30 },
  { cx: 238, cy: 24,  r: 0.8, op: 0.28 },
  { cx: 302, cy: 29,  r: 0.7, op: 0.26 },
  // Lower band cy 34–42: sparse near chart line
  { cx: 48,  cy: 37,  r: 0.8, op: 0.24 },
  { cx: 148, cy: 41,  r: 0.7, op: 0.23 },
  { cx: 242, cy: 38,  r: 0.9, op: 0.26, twinkle: true, delay: 1.8 },
  { cx: 330, cy: 36,  r: 0.7, op: 0.22 },
]

// ── Lunar phase ───────────────────────────────────────────────────────────────

const LUNAR_CYCLE = 29.53058867
const KNOWN_NEW_MOON_MS = new Date('2000-01-06T18:14:00Z').getTime()

function getLunarPhaseDays() {
  const elapsed = (Date.now() - KNOWN_NEW_MOON_MS) / 86400000
  return ((elapsed % LUNAR_CYCLE) + LUNAR_CYCLE) % LUNAR_CYCLE
}

// ── Planets ───────────────────────────────────────────────────────────────────

const PLANETS = [
  { cx: 284, cy: 24, orbitRx: 10, period: 50,  r: 3.2,
    inner: '#ffb28a', mid: '#d24a1f', outer: '#4a0e04', glow: 'rgba(220,70,30,0.30)', band: '#ffd0b6' },
  { cx: 144, cy: 13, orbitRx: 8,  period: 78,  r: 4.0,
    inner: '#fff3b8', mid: '#d49a31', outer: '#5a3808', glow: 'rgba(210,155,40,0.26)', band: '#fff0b8', ring: true },
  { cx: 58,  cy: 43, orbitRx: 6,  period: 112, r: 2.6,
    inner: '#b9d3ff', mid: '#3155d4', outer: '#060a48', glow: 'rgba(50,70,210,0.24)', band: '#d8e6ff' },
]

const CARD_SKY_STARS = [
  // Header/circled space: scattered above and around the stat text.
  { cx: 34,  cy: 12,  r: 0.7, op: 0.30 },
  { cx: 76,  cy: 8,   r: 0.9, op: 0.38, twinkle: true, delay: 0.9 },
  { cx: 124, cy: 20,  r: 0.7, op: 0.30 },
  { cx: 166, cy: 10,  r: 1.0, op: 0.44 },
  { cx: 208, cy: 26,  r: 0.8, op: 0.34, twinkle: true, delay: 2.6 },
  { cx: 252, cy: 14,  r: 0.7, op: 0.32 },
  { cx: 294, cy: 31,  r: 0.9, op: 0.36 },
  { cx: 322, cy: 78,  r: 0.8, op: 0.32, twinkle: true, delay: 1.5 },
  { cx: 136, cy: 52,  r: 0.8, op: 0.28 },
  { cx: 184, cy: 57,  r: 0.7, op: 0.27, twinkle: true, delay: 3.9 },
  { cx: 232, cy: 48,  r: 0.9, op: 0.34 },
  { cx: 278, cy: 64,  r: 0.7, op: 0.27 },
  { cx: 312, cy: 108, r: 0.8, op: 0.30 },
  // Top of the chart zone so the sky stays continuous between header and graph.
  { cx: 18,  cy: 114, r: 0.8, op: 0.28 },
  { cx: 54,  cy: 130, r: 0.7, op: 0.25 },
  { cx: 102, cy: 118, r: 0.8, op: 0.29, twinkle: true, delay: 4.4 },
  { cx: 150, cy: 134, r: 0.7, op: 0.24 },
  { cx: 198, cy: 120, r: 0.8, op: 0.28 },
  { cx: 246, cy: 136, r: 0.7, op: 0.25, twinkle: true, delay: 2.1 },
  { cx: 294, cy: 122, r: 0.8, op: 0.29 },
  { cx: 330, cy: 138, r: 0.7, op: 0.24 },
]

const CARD_SKY_PLANETS = [
  { cx: 160, cy: 42, r: 3.2, inner: '#fff3b8', mid: '#d89c2f', outer: '#5b3510', glow: 'rgba(236,185,65,0.22)', band: '#fff0b8', ring: true },
  { cx: 238, cy: 74, r: 2.5, inner: '#ffc09c', mid: '#d95b2a', outer: '#4b1307', glow: 'rgba(240,95,45,0.20)', band: '#ffd7c2' },
  { cx: 304, cy: 98, r: 2.8, inner: '#c1d9ff', mid: '#3155d4', outer: '#081248', glow: 'rgba(80,110,235,0.20)', band: '#e1ecff' },
]

// ── Moon ──────────────────────────────────────────────────────────────────────

function MoonGroup({ phaseDays, cx, cy, id }) {
  const r = 8
  const angleRad = (phaseDays / LUNAR_CYCLE) * 2 * Math.PI
  const illum  = (1 - Math.cos(angleRad)) / 2
  const waxing = phaseDays < LUNAR_CYCLE / 2
  const isNew  = illum < 0.04
  const isFull = illum > 0.96

  // Shadow gradient: waxing = dark bleeds in from left, waning = from right
  // T is where the terminator sits (0=left edge, 1=right edge of disc)
  const T   = waxing ? 1 - illum : illum
  const pad = 0.10
  const p0  = `${(Math.max(0,   T - pad) * 100).toFixed(1)}%`
  const p1  = `${(Math.min(1.0, T + pad) * 100).toFixed(1)}%`
  const sfx = `m-${id}`

  return (
    <g transform={`translate(${cx},${cy})`}>
      <defs>
        <filter id={`${sfx}-gf`} x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="3"/>
        </filter>
        {/* Spherical surface: highlight offset to lit side */}
        <radialGradient id={`${sfx}-surf`}
          cx={waxing ? '64%' : '36%'} cy="36%" r="70%"
          gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#f9f0d0"/>
          <stop offset="45%"  stopColor="#d8c070"/>
          <stop offset="80%"  stopColor="#a89050"/>
          <stop offset="100%" stopColor="#60542a"/>
        </radialGradient>
        {/* Phase shadow: linear gradient with soft terminator edge */}
        {!isNew && !isFull && (
          <linearGradient id={`${sfx}-shad`}
            x1={-r} y1="0" x2={r} y2="0"
            gradientUnits="userSpaceOnUse">
            {waxing ? (
              <>
                <stop offset="0%"  stopColor="#040c20" stopOpacity="1"/>
                <stop offset={p0}  stopColor="#040c20" stopOpacity="0.96"/>
                <stop offset={p1}  stopColor="#040c20" stopOpacity="0"/>
                <stop offset="100%" stopColor="#040c20" stopOpacity="0"/>
              </>
            ) : (
              <>
                <stop offset="0%"  stopColor="#040c20" stopOpacity="0"/>
                <stop offset={p0}  stopColor="#040c20" stopOpacity="0"/>
                <stop offset={p1}  stopColor="#040c20" stopOpacity="0.96"/>
                <stop offset="100%" stopColor="#040c20" stopOpacity="1"/>
              </>
            )}
          </linearGradient>
        )}
        <clipPath id={`${sfx}-clip`}>
          <circle cx="0" cy="0" r={r}/>
        </clipPath>
      </defs>

      {/* Atmospheric glow halo */}
      {!isNew && (
        <circle r={r + 3}
          fill={illum > 0.7 ? 'rgba(252,242,190,0.10)' : 'rgba(252,242,190,0.05)'}
          filter={`url(#${sfx}-gf)`}/>
      )}

      <g clipPath={`url(#${sfx}-clip)`}>
        {/* Deep space base */}
        <circle r={r} fill="#040c20"/>
        {/* Lit surface with spherical shading */}
        {!isNew && <circle r={r} fill={`url(#${sfx}-surf)`}/>}
        {/* Phase shadow overlay */}
        {!isNew && !isFull && (
          <rect x={-r} y={-r} width={r * 2} height={r * 2}
            fill={`url(#${sfx}-shad)`}/>
        )}
        {/* Crater marks — only visible on lit surface */}
        {!isNew && illum > 0.30 && (
          <>
            <circle cx={waxing ?  5.0 : -5.0} cy={-1.6} r={1.0}  fill="#040c20" opacity="0.23"/>
            <circle cx={waxing ?  3.8 : -3.8} cy={ 3.5} r={0.65} fill="#040c20" opacity="0.18"/>
            <circle cx={waxing ?  6.2 : -6.2} cy={ 1.5} r={0.48} fill="#040c20" opacity="0.14"/>
          </>
        )}
      </g>

      {/* Limb darkening ring */}
      <circle r={r} fill="none" stroke="rgba(0,6,18,0.55)" strokeWidth="1.4"/>
    </g>
  )
}

function StarMark({ star, glowId }) {
  const twinkleStyle = star.twinkle ? {
    animation: 'chartStarTwinkle 5.5s ease-in-out infinite',
    animationDelay: `${star.delay}s`,
  } : undefined
  const flare = Math.max(star.r * 4.2, 3.2)

  return (
    <g opacity={star.op} style={twinkleStyle}>
      <circle cx={star.cx} cy={star.cy} r={flare} fill="rgba(191,219,254,0.10)" filter={`url(#${glowId})`}/>
      <circle cx={star.cx} cy={star.cy} r={star.r * 1.15} fill="#fffaf0"/>
      <circle cx={star.cx - star.r * 0.28} cy={star.cy - star.r * 0.28} r={star.r * 0.42} fill="#ffffff" opacity="0.82"/>
      {star.r >= 0.85 && (
        <g stroke="#fff7d6" strokeWidth={Math.max(0.35, star.r * 0.32)} strokeLinecap="round" opacity="0.72">
          <line x1={star.cx - flare * 0.72} y1={star.cy} x2={star.cx + flare * 0.72} y2={star.cy}/>
          <line x1={star.cx} y1={star.cy - flare * 0.72} x2={star.cx} y2={star.cy + flare * 0.72}/>
        </g>
      )}
    </g>
  )
}

function PlanetOrb({ planet, cx, cy, id }) {
  const gradId = `planet-surf-${id}`
  const glowId = `planet-glow-${id}`
  const clipId = `planet-clip-${id}`
  const shadowId = `planet-shadow-${id}`
  const r = planet.r

  return (
    <g>
      <defs>
        <radialGradient id={gradId} cx="34%" cy="26%" r="74%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92"/>
          <stop offset="18%" stopColor={planet.inner} stopOpacity="1"/>
          <stop offset="58%" stopColor={planet.mid} stopOpacity="0.98"/>
          <stop offset="100%" stopColor={planet.outer} stopOpacity="1"/>
        </radialGradient>
        <radialGradient id={shadowId} cx="74%" cy="76%" r="78%" gradientUnits="objectBoundingBox">
          <stop offset="45%" stopColor="#000" stopOpacity="0"/>
          <stop offset="100%" stopColor="#000" stopOpacity="0.50"/>
        </radialGradient>
        <filter id={glowId} x="-190%" y="-190%" width="480%" height="480%">
          <feGaussianBlur stdDeviation="2.5"/>
        </filter>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={r}/>
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r * 2.65} fill={planet.glow} filter={`url(#${glowId})`}/>
      {planet.ring && (
        <g transform={`rotate(-16 ${cx} ${cy})`} opacity="0.64">
          <ellipse cx={cx} cy={cy} rx={r * 2.15} ry={r * 0.62} fill="none" stroke="rgba(255,226,156,0.72)" strokeWidth="0.62"/>
          <ellipse cx={cx} cy={cy} rx={r * 1.72} ry={r * 0.48} fill="none" stroke="rgba(255,255,255,0.26)" strokeWidth="0.34"/>
        </g>
      )}
      <g clipPath={`url(#${clipId})`}>
        <circle cx={cx} cy={cy} r={r} fill={`url(#${gradId})`}/>
        <path d={`M${cx - r * 1.25} ${cy - r * 0.22} C${cx - r * 0.35} ${cy - r * 0.56}, ${cx + r * 0.45} ${cy - r * 0.42}, ${cx + r * 1.25} ${cy - r * 0.68}`} fill="none" stroke={planet.band || '#fff'} strokeWidth={Math.max(0.22, r * 0.18)} opacity="0.38"/>
        <path d={`M${cx - r * 1.3} ${cy + r * 0.22} C${cx - r * 0.30} ${cy + r * 0.50}, ${cx + r * 0.42} ${cy + r * 0.38}, ${cx + r * 1.3} ${cy + r * 0.12}`} fill="none" stroke={planet.band || '#fff'} strokeWidth={Math.max(0.18, r * 0.14)} opacity="0.25"/>
        <circle cx={cx} cy={cy} r={r} fill={`url(#${shadowId})`}/>
        <circle cx={cx - r * 0.34} cy={cy - r * 0.36} r={r * 0.28} fill="#fff" opacity="0.30"/>
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.48)" strokeWidth="0.55"/>
    </g>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function samplePolyline(points, t) {
  if (!points.length) return { x: W / 2, y: H / 2, angle: 0 }
  if (points.length === 1) return { x: points[0].x, y: points[0].y, angle: 0 }

  const segLengths = []
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x
    const dy = points[i + 1].y - points[i].y
    const len = Math.hypot(dx, dy) || 1
    segLengths.push(len)
    total += len
  }

  let target = clamp(t, 0, 1) * total
  for (let i = 0; i < segLengths.length; i++) {
    const len = segLengths[i]
    if (target <= len || i === segLengths.length - 1) {
      const a = points[i]
      const b = points[i + 1]
      const pct = len ? target / len : 0
      const x = a.x + (b.x - a.x) * pct
      const y = a.y + (b.y - a.y) * pct
      const angle = clamp(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI, -18, 18)
      return { x, y, angle }
    }
    target -= len
  }

  return { ...points[points.length - 1], angle: 0 }
}

function polylineLength(points) {
  if (points.length < 2) return 0
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y)
  }
  return total
}

function buildWalkerFrames(points, figSize, footFrac) {
  if (points.length <= 1) {
    const { x, y, angle } = samplePolyline(points, 0)
    const leftPct = (x / W * 100).toFixed(3)
    const top = (y - figSize * footFrac).toFixed(2)
    return `0%{left:clamp(0px,calc(${leftPct}% - ${figSize / 2}px),calc(100% - ${figSize}px));top:${top}px;transform:rotate(${angle.toFixed(2)}deg);}`
  }

  const exactPointLimit = 80
  const segLengths = []
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const len = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y) || 1
    segLengths.push(len)
    total += len
  }

  const frameAt = (pct, x, y, angle) => {
    const leftPct = (x / W * 100).toFixed(3)
    const top = (y - figSize * footFrac).toFixed(2)
    return `${pct.toFixed(2)}%{left:clamp(0px,calc(${leftPct}% - ${figSize / 2}px),calc(100% - ${figSize}px));top:${top}px;transform:rotate(${angle.toFixed(2)}deg);}`
  }

  if (points.length <= exactPointLimit) {
    let walked = 0
    return points.map((p, i) => {
      if (i > 0) walked += segLengths[i - 1]
      const prev = points[Math.max(0, i - 1)]
      const next = points[Math.min(points.length - 1, i + 1)]
      const angle = clamp(Math.atan2(next.y - prev.y, next.x - prev.x) * 180 / Math.PI, -18, 18)
      return frameAt(total ? walked / total * 100 : 0, p.x, p.y, angle)
    }).join('\n')
  }

  const samples = 90
  return Array.from({ length: samples }, (_, i) => {
    const t = i / (samples - 1)
    const { x, y, angle } = samplePolyline(points, t)
    return frameAt(t * 100, x, y, angle)
  }).join('\n')
}

// ── Sky object icons ──────────────────────────────────────────────────────────

function RocketSVGVertical() {
  return (
    <svg width="10" height="20" viewBox="0 0 10 20" style={{ display: 'block' }}>
      {/* Exhaust flame — drawn first so body renders on top */}
      <ellipse cx="5" cy="17.5" rx="2.8" ry="4.5" fill="#fb923c" opacity="0.52"/>
      <ellipse cx="5" cy="16.5" rx="1.5" ry="2.8" fill="#fde68a" opacity="0.72"/>
      {/* Main body — pointed nose at top */}
      <path d="M5 0 C3.5 0 2 3.5 2 7 L2 13 L8 13 L8 7 C8 3.5 6.5 0 5 0Z" fill="#e2e8f0" opacity="0.92"/>
      {/* Nozzle bell */}
      <path d="M3 13 L2.5 15.5 L7.5 15.5 L7 13Z" fill="#94a3b8" opacity="0.75"/>
      {/* Porthole */}
      <circle cx="5" cy="7.5" r="1.4" fill="#7dd3fc" opacity="0.82"/>
      {/* Fins */}
      <path d="M2 10.5 L0 14.5 L3.5 13Z" fill="#94a3b8" opacity="0.75"/>
      <path d="M8 10.5 L10 14.5 L6.5 13Z" fill="#94a3b8" opacity="0.75"/>
    </svg>
  )
}

function SatelliteSVG() {
  return (
    <svg width="26" height="10" viewBox="0 0 26 10"
      style={{ display: 'block' }}>
      <rect x="0" y="2.5" width="7" height="5" rx="0.5" fill="#3b82f6" opacity="0.70"/>
      <line x1="7" y1="5" x2="9" y2="5" stroke="#94a3b8" strokeWidth="0.8"/>
      <rect x="9" y="3" width="8" height="4" rx="1" fill="#cbd5e1" opacity="0.88"/>
      <line x1="17" y1="5" x2="19" y2="5" stroke="#94a3b8" strokeWidth="0.8"/>
      <rect x="19" y="2.5" width="7" height="5" rx="0.5" fill="#3b82f6" opacity="0.70"/>
      <line x1="13" y1="3" x2="13" y2="0.5" stroke="#94a3b8" strokeWidth="0.8"/>
      <circle cx="13" cy="0.5" r="0.8" fill="#94a3b8" opacity="0.80"/>
    </svg>
  )
}

function MeteorSVG({ fromRight = false }) {
  const gid = fromRight ? 'meteor-trail-rtl' : 'meteor-trail-ltr'
  return (
    <svg width="96" height="18" viewBox="0 0 96 18" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1={fromRight ? '100%' : '0%'} y1="50%" x2={fromRight ? '0%' : '100%'} y2="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0"/>
          <stop offset="58%" stopColor="#dbeafe" stopOpacity="0.22"/>
          <stop offset="86%" stopColor="#bfdbfe" stopOpacity="0.76"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="1"/>
        </linearGradient>
        <filter id={`${gid}-glow`} x="-20%" y="-180%" width="140%" height="460%">
          <feGaussianBlur stdDeviation="1.4"/>
        </filter>
      </defs>
      <g transform={fromRight ? 'rotate(17 48 9)' : 'rotate(-17 48 9)'}>
        <line x1="4" y1="9" x2="90" y2="9" stroke={`url(#${gid})`} strokeWidth="2.2" strokeLinecap="round" filter={`url(#${gid}-glow)`}/>
        <line x1="18" y1="9" x2="90" y2="9" stroke={`url(#${gid})`} strokeWidth="1.15" strokeLinecap="round"/>
        <circle cx="91" cy="9" r="4.6" fill="rgba(191,219,254,0.32)" filter={`url(#${gid}-glow)`}/>
        <circle cx="91" cy="9" r="2.2" fill="#fff7ed"/>
      </g>
    </svg>
  )
}

// ── RobinhoodChart ─────────────────────────────────────────────────────────────
//
// points: [{ date: 'YYYY-MM-DD', value: number }] — sorted ascending
// The component slices to the selected range internally.
// Header shows value at hover / current + Δ from range start (like Robinhood portfolio).

export default function RobinhoodChart({
  points = [],
  color  = '#22c55e',
  ranges = ['1D', '1W', '1M', '1Y', '5Y'],
  defaultRange = '1W',
  isDark = true,
  unit   = 'reps',
  title  = 'Growth',
  subtitle = 'total accumulated',
  emptyLabel = 'Log your first workout to see your chart',
  showSun = false,
}) {
  const [range,   setRange]   = useState(defaultRange)
  const [hovered, setHovered] = useState(null)
  const svgRef = useRef(null)
  const chartId = useId().replace(/:/g, '')
  const lunarPhase = getLunarPhaseDays()
  const [animationPaused, setAnimationPaused] = useState(() => {
    if (typeof window === 'undefined') return false
    return document.visibilityState !== 'visible' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const update = () => setAnimationPaused(document.visibilityState !== 'visible' || !!media?.matches)
    update()
    document.addEventListener('visibilitychange', update)
    media?.addEventListener?.('change', update)
    return () => {
      document.removeEventListener('visibilitychange', update)
      media?.removeEventListener?.('change', update)
    }
  }, [])
  const decorativeMotion = showSun && isDark && !animationPaused

  // ── Sky objects (rocket / satellite) ─────────────────────────────────────────
  const skyTimerRef    = useRef(null)
  const scheduleNextRef = useRef(null)
  const [skyObject, setSkyObject] = useState(null)

  useEffect(() => {
    if (!decorativeMotion) { clearTimeout(skyTimerRef.current); setSkyObject(null); return }
    function scheduleNext() {
      skyTimerRef.current = setTimeout(() => {
        const roll = Math.random()
        setSkyObject({
          type: roll < 0.34 ? 'rocket' : roll < 0.67 ? 'satellite' : 'meteor',
          id: Date.now(),
          fromRight: Math.random() < 0.5,
          xPos: Math.floor(20 + Math.random() * 260),
          yPos: Math.floor(2 + Math.random() * (PAD_T - 14)),
        })
      }, 30000 + Math.random() * 30000)
    }
    scheduleNextRef.current = scheduleNext
    scheduleNext()
    return () => {
      clearTimeout(skyTimerRef.current)
      scheduleNextRef.current = null
    }
  }, [decorativeMotion])

  function handleSkyAnimEnd() {
    setSkyObject(null)
    scheduleNextRef.current?.()
  }

  // ── Slice ──────────────────────────────────────────────────────────────────

  const days   = RANGE_DAYS[range]
  const sliced = days ? points.slice(-days) : points

  // ── Header values ──────────────────────────────────────────────────────────

  const { tipVal, tipDate, delta, displayVal } = computeChartHeader({ sliced, hovered, range })

  // ── SVG geometry ──────────────────────────────────────────────────────────

  const iH    = H - PAD_T - PAD_B
  const maxV  = Math.max(...sliced.map(p => p.value), 1)
  const minV  = sliced.length ? Math.min(...sliced.map(p => p.value)) : 0
  const spanV = maxV - minV || 1
  const cx = i => sliced.length > 1 ? (i / (sliced.length - 1)) * W : W / 2
  const cy = v => PAD_T + iH - ((v - minV) / spanV) * iH

  const linePath = sliced
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${cx(i).toFixed(1)},${cy(p.value).toFixed(1)}`)
    .join(' ')

  const areaPath = sliced.length
    ? `${linePath} L${cx(sliced.length - 1).toFixed(1)},${H} L0,${H} Z`
    : ''

  // ── Interaction ────────────────────────────────────────────────────────────

  function onMove(clientX) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || sliced.length < 2) return
    const idx = Math.max(0, Math.min(
      sliced.length - 1,
      Math.round(((clientX - rect.left) / rect.width) * (sliced.length - 1)),
    ))
    setHovered(idx)
  }

  const hovX = hovered != null ? cx(hovered) : null
  const hovY = hovered != null ? cy(sliced[hovered]?.value ?? 0) : null
  const gradId = `rh-${chartId}-${color.replace('#', '')}`

  // ── Walker figure motion ──────────────────────────────────────────────────
  // The chart's SVG uses preserveAspectRatio="none": x scales with container
  // width while y maps 1-to-1 to CSS px (viewBox height = rendered height).
  // Sample the visible polyline and emit CSS keyframes in percent-x + px-y so
  // the absolutely positioned walker follows the actual chart path for every
  // selected range instead of sliding across a straight line.

  const FIG = 22
  const WALKER_COLOR = '#92400e'
  const FIG_VIEWBOX = 24
  const FOOT_Y = 22.98
  const FOOT_FRAC = FOOT_Y / FIG_VIEWBOX
  const walkerPath = sliced.length
    ? sliced.map((p, i) => ({ x: cx(i), y: cy(p.value) }))
    : []
  const walkerFrames = buildWalkerFrames(walkerPath, FIG, FOOT_FRAC)
  const walkerAnimName = `chartWalkerWalk-${chartId}-${range}`
  const walkerGaitName = `chartWalkerGait-${chartId}`
  const walkerLegFrontName = `chartWalkerLegFront-${chartId}`
  const walkerLegBackName = `chartWalkerLegBack-${chartId}`
  const walkerArmFrontName = `chartWalkerArmFront-${chartId}`
  const walkerArmBackName = `chartWalkerArmBack-${chartId}`
  const walkerDuration = 32
  const walkerDistance = polylineLength(walkerPath)
  const walkerSpeed = walkerDistance / walkerDuration
  const walkerGaitDuration = clamp(12 / Math.max(walkerSpeed, 1), 0.78, 2.4)

  // ── Empty state ────────────────────────────────────────────────────────────

  if (!points.length) {
    return (
      <div style={{
        background: 'var(--surface)', borderRadius: 20,
        padding: '28px 18px', marginBottom: 16,
        border: '1.5px solid var(--border)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
          {emptyLabel}
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
    <style>{`
      @keyframes ${walkerAnimName} {
        ${walkerFrames}
      }
      @keyframes ${walkerGaitName} {
        0%, 100% { transform: translateY(0) rotate(-1deg); }
        25%      { transform: translateY(-0.7px) rotate(1.3deg); }
        50%      { transform: translateY(0) rotate(-1deg); }
        75%      { transform: translateY(-0.7px) rotate(1.3deg); }
      }
      @keyframes ${walkerLegFrontName} {
        0%, 100% { transform: rotate(24deg); }
        50%      { transform: rotate(-24deg); }
      }
      @keyframes ${walkerLegBackName} {
        0%, 100% { transform: rotate(-24deg); }
        50%      { transform: rotate(24deg); }
      }
      @keyframes ${walkerArmFrontName} {
        0%, 100% { transform: rotate(-18deg); }
        50%      { transform: rotate(18deg); }
      }
      @keyframes ${walkerArmBackName} {
        0%, 100% { transform: rotate(18deg); }
        50%      { transform: rotate(-18deg); }
      }
      @keyframes chartStarTwinkle {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.15; }
      }
      @keyframes skyObjLTR {
        from { transform: translateX(-60px); }
        to   { transform: translateX(500px); }
      }
      @keyframes skyObjRTL {
        from { transform: translateX(500px); }
        to   { transform: translateX(-60px); }
      }
      @keyframes meteorLTR {
        0%   { transform: translate(-120px, 0); opacity: 0; }
        10%  { opacity: 1; }
        72%  { opacity: 0.95; }
        100% { transform: translate(460px, 34px); opacity: 0; }
      }
      @keyframes meteorRTL {
        0%   { transform: translate(460px, 0); opacity: 0; }
        10%  { opacity: 1; }
        72%  { opacity: 0.95; }
        100% { transform: translate(-120px, 34px); opacity: 0; }
      }
      @keyframes sunRayRotate {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
      @keyframes sunCoronaPulse {
        0%, 100% { opacity: 0.7; }
        50%      { opacity: 1.0; }
      }
      @keyframes rocketLaunch {
        from { transform: translateY(0); }
        to   { transform: translateY(-320px); }
      }
    `}</style>
    <div style={{
      background: 'var(--surface)', borderRadius: 20,
      padding: '18px 18px 12px', marginBottom: 16,
      border: '1.5px solid var(--border)', overflow: 'hidden',
      position: 'relative',
    }}>

      {/* ── Card-wide space backdrop fills the header/circled blank area ── */}
      {decorativeMotion && (
        <svg
          aria-hidden="true"
          viewBox="0 0 340 148"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 8,
            width: '100%',
            height: 148,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          <defs>
            <filter id={`card-star-glow-${chartId}`} x="-220%" y="-220%" width="540%" height="540%">
              <feGaussianBlur stdDeviation="1.15"/>
            </filter>
          </defs>
          {CARD_SKY_STARS.map((s, i) => (
            <StarMark
              key={`card-star-${i}`}
              star={s}
              glowId={`card-star-glow-${chartId}`}
            />
          ))}
          {CARD_SKY_PLANETS.map((p, i) => (
            <PlanetOrb key={`card-planet-${i}`} planet={p} cx={p.cx} cy={p.cy} id={`card-${i}-${chartId}`}/>
          ))}
        </svg>
      )}

      {/* ── Sun decoration top-right of card ── */}
      {decorativeMotion && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', top: 10, right: 12,
            pointerEvents: 'none', zIndex: 1,
            opacity: hovered != null ? 0 : 0.48,
            transition: 'opacity 0.18s',
          }}
        >
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <defs>
              <radialGradient id={`sun-disc-${chartId}`} cx="40%" cy="36%" r="62%" gradientUnits="objectBoundingBox">
                <stop offset="0%"   stopColor="#fffcee"/>
                <stop offset="28%"  stopColor="#fef3a0"/>
                <stop offset="62%"  stopColor="#fbbf24"/>
                <stop offset="100%" stopColor="#f59e0b"/>
              </radialGradient>
              <radialGradient id={`sun-glo-${chartId}`} cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
                <stop offset="25%" stopColor="#fde68a" stopOpacity="0.55"/>
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="0"/>
              </radialGradient>
              <filter id={`sun-f-${chartId}`} x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="3.5"/>
              </filter>
            </defs>
            {/* Corona glow */}
            <circle cx="22" cy="22" r="17"
              fill={`url(#sun-glo-${chartId})`}
              filter={`url(#sun-f-${chartId})`}
              style={{ animation: 'sunCoronaPulse 4s ease-in-out infinite' }}
            />
            {/* Rotating rays */}
            <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'sunRayRotate 60s linear infinite' }}>
              {[0,45,90,135,180,225,270,315].map((deg, i) => {
                const a = deg * Math.PI / 180
                return (
                  <line key={`mr${i}`}
                    x1={(22 + Math.cos(a) * 10.5).toFixed(2)} y1={(22 + Math.sin(a) * 10.5).toFixed(2)}
                    x2={(22 + Math.cos(a) * 18.0).toFixed(2)} y2={(22 + Math.sin(a) * 18.0).toFixed(2)}
                    stroke="#fde68a" strokeWidth="1.9" strokeLinecap="round" opacity="0.88"
                  />
                )
              })}
              {[22.5,67.5,112.5,157.5,202.5,247.5,292.5,337.5].map((deg, i) => {
                const a = deg * Math.PI / 180
                return (
                  <line key={`sr${i}`}
                    x1={(22 + Math.cos(a) * 11.0).toFixed(2)} y1={(22 + Math.sin(a) * 11.0).toFixed(2)}
                    x2={(22 + Math.cos(a) * 15.0).toFixed(2)} y2={(22 + Math.sin(a) * 15.0).toFixed(2)}
                    stroke="#fde68a" strokeWidth="1.1" strokeLinecap="round" opacity="0.60"
                  />
                )
              })}
            </g>
            {/* Solar disc */}
            <circle cx="22" cy="22" r="8.5" fill={`url(#sun-disc-${chartId})`}/>
            {/* Specular highlight */}
            <circle cx="19" cy="19" r="2.8" fill="white" opacity="0.28"/>
          </svg>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ marginBottom: 10 }}>
        <div style={{
          fontSize: 11, fontWeight: 800, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 9,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 36, fontWeight: 900, letterSpacing: '-2px', lineHeight: 1,
          color: 'var(--text)',
        }}>
          {displayVal.toLocaleString()}
        </div>
        <div style={{
          fontSize: 12, fontWeight: 700, color: 'var(--muted)',
          marginTop: 5, letterSpacing: '-0.2px',
        }}>
          {tipVal.toLocaleString()} total {unit}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 600, color: 'var(--muted)',
          marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.4px',
        }}>
          {hovered != null ? fmtDate(tipDate) : subtitle}
        </div>
      </div>

      {/* ── Chart — bleeds to card edges ── */}
      <div style={{ margin: '0 -18px', position: 'relative' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: H, display: 'block', cursor: 'crosshair' }}
          preserveAspectRatio="none"
          onMouseMove={e => onMove(e.clientX)}
          onMouseLeave={() => setHovered(null)}
          onTouchMove={e => { onMove(e.touches[0].clientX) }}
          onTouchEnd={() => setHovered(null)}
        >
          {/* Starfield — Growth card only, dark mode only */}
          {decorativeMotion && STARS.map((s, i) => (
            <StarMark
              key={i}
              star={s}
              glowId={`chart-star-glow-${chartId}`}
            />
          ))}

          {/* Moon with current phase */}
          {decorativeMotion && (
            <MoonGroup phaseDays={lunarPhase} cx={53} cy={13} id={chartId}/>
          )}

          {/* Background planets — gradient-shaded glowing orbs */}
          {decorativeMotion && PLANETS.map((p, i) => {
            return (
              <g key={`pl-${i}`}>
                <g>
                  <animateTransform attributeName="transform" type="rotate"
                    from={`0 ${p.cx} ${p.cy}`} to={`360 ${p.cx} ${p.cy}`}
                    dur={`${p.period}s`} repeatCount="indefinite"/>
                  <PlanetOrb planet={p} cx={p.cx + p.orbitRx} cy={p.cy} id={`orb-${i}-${chartId}`}/>
                </g>
              </g>
            )
          })}

          <defs>
            <filter id={`chart-star-glow-${chartId}`} x="-220%" y="-220%" width="540%" height="540%">
              <feGaussianBlur stdDeviation="1.05"/>
            </filter>
            <linearGradient id={gradId} x1="0" y1={PAD_T} x2="0" y2={H} gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor={color} stopOpacity={isDark ? '0.22' : '0.13'} />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}

          {/* Line */}
          <path d={linePath} fill="none" stroke={color} strokeWidth="1.8"
            strokeLinejoin="round" strokeLinecap="round" />

          {/* Crosshair + dot */}
          {hovered != null && hovX != null && (
            <>
              <line
                x1={hovX.toFixed(1)} y1={PAD_T}
                x2={hovX.toFixed(1)} y2={H}
                stroke={isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)'}
                strokeWidth="1"
              />
              <circle
                cx={hovX.toFixed(1)} cy={hovY.toFixed(1)}
                r="4.5" fill={color} stroke="var(--surface)" strokeWidth="2.5"
              />
            </>
          )}
        </svg>

        {/* ── Occasional sky objects: rocket (vertical) / satellite (horizontal) ── */}
        {decorativeMotion && skyObject && (
          skyObject.type === 'rocket' ? (
            /* Rocket launches from chart line upward — card overflow:hidden clips at card top */
            <div
              key={skyObject.id}
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: PAD_T,
                left: skyObject.xPos,
                width: 10,
                height: 0,
                pointerEvents: 'none',
                zIndex: 3,
                opacity: 0.88,
              }}
            >
              <div
                style={{ position: 'absolute', bottom: 0, animation: 'rocketLaunch 4.5s ease-in forwards' }}
                onAnimationEnd={handleSkyAnimEnd}
              >
                <RocketSVGVertical/>
              </div>
            </div>
          ) : skyObject.type === 'meteor' ? (
            /* Meteor flashes diagonally through the clipped sky zone */
            <div
              key={skyObject.id}
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: PAD_T,
                overflow: 'hidden',
                pointerEvents: 'none',
                zIndex: 3,
              }}
              onAnimationEnd={handleSkyAnimEnd}
            >
              <div
                style={{
                  position: 'absolute',
                  top: skyObject.yPos,
                  left: 0,
                  animation: skyObject.fromRight
                    ? 'meteorRTL 1.45s cubic-bezier(.12,.62,.22,1) forwards'
                    : 'meteorLTR 1.45s cubic-bezier(.12,.62,.22,1) forwards',
                }}
              >
                <MeteorSVG fromRight={skyObject.fromRight}/>
              </div>
            </div>
          ) : (
            /* Satellite drifts slowly across the sky zone */
            <div
              key={skyObject.id}
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: skyObject.yPos,
                left: 0,
                pointerEvents: 'none',
                zIndex: 1,
                opacity: 0.78,
                animation: skyObject.fromRight
                  ? 'skyObjRTL 13s linear forwards'
                  : 'skyObjLTR 13s linear forwards',
              }}
              onAnimationEnd={handleSkyAnimEnd}
            >
              <SatelliteSVG/>
            </div>
          )
        )}

        {/* ── Ambient walker follows the visible chart path ── */}
        {sliced.length > 0 && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: `clamp(0px, calc(${(walkerPath[0].x / W * 100).toFixed(3)}% - ${FIG / 2}px), calc(100% - ${FIG}px))`,
              top: walkerPath[0].y - FIG * FOOT_FRAC,
              pointerEvents: 'none',
              opacity: hovered != null ? 0 : 1,
              transition: 'opacity 0.18s',
              zIndex: 2,
              width: FIG,
              transformOrigin: `50% ${FOOT_FRAC * 100}%`,
              animation: !animationPaused && sliced.length > 1 ? `${walkerAnimName} ${walkerDuration}s linear infinite` : undefined,
            }}
          >
            {/* articulated 2-frame gait: limbs counter-swing while wrapper follows line */}
            <svg
              width={FIG}
              height={FIG}
              viewBox="0 0 24 24"
              style={{
                display: 'block',
                overflow: 'visible',
                filter: `drop-shadow(0 1px 3px ${WALKER_COLOR}88)`,
                transformOrigin: `50% ${FOOT_FRAC * 100}%`,
                animation: !animationPaused && sliced.length > 1 ? `${walkerGaitName} ${walkerGaitDuration}s ease-in-out infinite` : undefined,
              }}
            >
              <g
                stroke={WALKER_COLOR}
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              >
                <line x1="12" y1="8" x2="12" y2="13.1" />
                <g style={{ transformBox: 'view-box', transformOrigin: '12px 12.6px', animation: !animationPaused && sliced.length > 1 ? `${walkerLegFrontName} ${walkerGaitDuration}s ease-in-out infinite` : undefined }}>
                  <path d="M12 12.6 L12.1 17.1 L10.2 22.5" />
                </g>
                <g style={{ transformBox: 'view-box', transformOrigin: '12px 12.6px', animation: !animationPaused && sliced.length > 1 ? `${walkerLegBackName} ${walkerGaitDuration}s ease-in-out infinite` : undefined }}>
                  <path d="M12 12.6 L12.0 17.0 L14.1 22.5" opacity="0.72" />
                </g>
                <g style={{ transformBox: 'view-box', transformOrigin: '12px 9.2px', animation: !animationPaused && sliced.length > 1 ? `${walkerArmFrontName} ${walkerGaitDuration}s ease-in-out infinite` : undefined }}>
                  <path d="M12 9.2 L9.1 13.2 L8.3 16.2" />
                </g>
                <g style={{ transformBox: 'view-box', transformOrigin: '12px 9.2px', animation: !animationPaused && sliced.length > 1 ? `${walkerArmBackName} ${walkerGaitDuration}s ease-in-out infinite` : undefined }}>
                  <path d="M12 9.2 L14.9 12.7 L16.1 15.8" opacity="0.72" />
                </g>
              </g>
              <circle cx="12" cy="5.2" r="2.6" fill={WALKER_COLOR} />
              <path d="M10.9 7.8 L13.2 7.8 L12 13.1 Z" fill={WALKER_COLOR} />
            </svg>
          </div>
        )}
      </div>

      {/* ── Range pills ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-around',
        marginTop: 14, paddingTop: 12,
        borderTop: '1px solid var(--border)',
      }}>
        {ranges.map(r => (
          <button
            key={r}
            onClick={() => { setRange(r); setHovered(null) }}
            style={{
              flex: 1, padding: '6px 2px', borderRadius: 8,
              fontSize: 12, fontWeight: 700,
              background: range === r
                ? (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)')
                : 'transparent',
              color: range === r ? 'var(--text)' : 'var(--muted)',
              border: 'none', cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
    </>
  )
}
