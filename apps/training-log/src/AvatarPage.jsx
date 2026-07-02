import { useState, useMemo } from 'react'
import { useT } from './LanguageContext.jsx'

// ── Utilities ─────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function goalLabel(g, tl) {
  if (!tl) {
    if (g === 'build_muscle') return 'Build Muscle'
    if (g === 'lose_fat') return 'Lose Fat'
    return 'Maintain'
  }
  if (g === 'build_muscle') return tl('goal_build_muscle')
  if (g === 'lose_fat') return tl('goal_lose_fat')
  return tl('goal_maintain')
}

// Count logged reps from a single day's data object.
// Excludes timed fields (dead_hang, meditation) — their values are seconds, not reps.
// Custom exercises are filtered to rep-only types, matching progressSeries.js logic.
function dayReps(data, customExercises = []) {
  if (!data) return 0
  let total = 0
  total += data.pushups     || 0
  total += data.squats      || 0
  total += data.situps      || 0
  total += data.pullups     || 0
  total += data.dips        || 0
  total += data.curls       || 0
  total += data.bench?.reps || 0
  total += data.books       || 0
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith('custom_')) continue
    const def = customExercises.find(ex => ex.id === k)
    if (!def || !['reps', 'weighted_reps', 'bench'].includes(def.type)) continue
    if (typeof v === 'number') total += v
    else if (v?.reps) total += v.reps
  }
  return total
}

const TIERS = [
  { id: 'beginner',  label: 'Beginner',  min: 0 },
  { id: 'active',    label: 'Active',    min: 1000 },
  { id: 'dedicated', label: 'Dedicated', min: 5000 },
  { id: 'advanced',  label: 'Advanced',  min: 20000 },
  { id: 'elite',     label: 'Elite',     min: 75000 },
]

// Derive all mirror stats from history array + today's dayData
function computeTrainingStats(history, dayData, customExercises = []) {
  const today = todayStr()

  // Merge history with today's unsaved data
  const allDays = [
    ...history.filter(d => d.date !== today),
    { date: today, ...dayData },
  ]

  const byDate = {}
  let totalVolume = 0
  for (const d of allDays) {
    const r = dayReps(d, customExercises)
    byDate[d.date] = r
    totalVolume += r
  }

  // Consecutive-day streak ending today (today counts even if it's still early)
  let streak = 0
  const streakCur = new Date()
  for (let i = 0; i < 365; i++) {
    const key = streakCur.toISOString().slice(0, 10)
    if ((byDate[key] || 0) > 0) { streak++; streakCur.setDate(streakCur.getDate() - 1) }
    else if (i > 0) break
    else streakCur.setDate(streakCur.getDate() - 1)
  }

  // Last 28 calendar days
  const last28 = []
  const now = new Date()
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    last28.push({ date: key, reps: byDate[key] || 0, active: (byDate[key] || 0) > 0 })
  }
  const activeDays28  = last28.filter(d => d.active).length
  const consistency28 = Math.round((activeDays28 / 28) * 100)
  const vol28         = last28.reduce((s, d) => s + d.reps, 0)

  // Previous 28 days (days 29–56 ago) for trend
  const prev28 = []
  for (let i = 55; i >= 28; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    prev28.push(byDate[key] || 0)
  }
  const volPrev28 = prev28.reduce((s, v) => s + v, 0)

  // When volPrev28 is 0, treat any current activity as +100% (started from nothing),
  // and zero current activity as 0% (no change either period).
  const volTrend = volPrev28 > 0
    ? Math.round(((vol28 - volPrev28) / volPrev28) * 100)
    : vol28 > 0 ? 100 : 0

  // This week (last 7 of last28)
  const last7            = last28.slice(-7)
  const sessionsThisWeek = last7.filter(d => d.active).length
  const volumeThisWeek   = last7.reduce((s, d) => s + d.reps, 0)

  // Tier
  const tierIdx = TIERS.reduce((best, t, i) => totalVolume >= t.min ? i : best, 0)
  const tier    = TIERS[tierIdx]
  const nextTier = TIERS[tierIdx + 1] || null

  return {
    totalVolume,
    streak,
    activeDays28,
    consistency28,
    vol28,
    volTrend,
    sessionsThisWeek,
    volumeThisWeek,
    tier,
    tierIdx,
    nextTier,
    last28,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

// 28-day consistency dot grid: 4 rows of 7
function ConsistencyGrid({ last28 }) {
  const weeks = [last28.slice(0, 7), last28.slice(7, 14), last28.slice(14, 21), last28.slice(21, 28)]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: 'flex', gap: 5 }}>
          {week.map((day, di) => (
            <div
              key={di}
              title={`${day.date}: ${day.reps.toLocaleString()} reps`}
              style={{
                flex: 1,
                aspectRatio: '1',
                borderRadius: '50%',
                background: day.active
                  ? 'var(--accent)'
                  : 'rgba(128,128,128,0.15)',
                maxWidth: 14,
                minWidth: 8,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// 5-node tier scale
function TierScale({ tierIdx }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 0 }}>
      {TIERS.map((t, i) => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', flex: i < TIERS.length - 1 ? 1 : 0 }}>
          {/* Dot */}
          <div style={{
            width:       i === tierIdx ? 10 : 7,
            height:      i === tierIdx ? 10 : 7,
            borderRadius: '50%',
            background:  i <= tierIdx ? 'var(--accent)' : 'rgba(128,128,128,0.2)',
            flexShrink:  0,
            boxShadow:   i === tierIdx ? '0 0 0 3px rgba(var(--accent-rgb, 139,92,246),0.2)' : 'none',
          }} />
          {/* Connecting line */}
          {i < TIERS.length - 1 && (
            <div style={{
              flex: 1,
              height: 2,
              background: i < tierIdx
                ? 'var(--accent)'
                : 'rgba(128,128,128,0.15)',
            }} />
          )}
        </div>
      ))}
    </div>
  )
}

// Profile bottom sheet
function ProfileSheet({ profile, onSave, onClose }) {
  const tl = useT()
  const [form, setForm] = useState({
    gender:       profile.gender       || '',
    height_ft:    profile.height_ft    !== undefined ? String(profile.height_ft) : '',
    height_in:    profile.height_in    !== undefined ? String(profile.height_in) : '',
    weight:       profile.weight       !== undefined ? String(profile.weight)    : '',
    body_fat:     profile.body_fat     !== undefined ? String(profile.body_fat)  : '',
    fitness_goal: profile.fitness_goal || 'maintain',
  })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [err,    setErr]    = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const valid = form.gender && form.height_ft && form.weight

  async function save() {
    if (!valid || saving) return
    setSaving(true)
    setErr(null)
    try {
      await onSave({
        gender:       form.gender,
        height_ft:    parseInt(form.height_ft)   || 0,
        height_in:    parseInt(form.height_in)   || 0,
        weight:       parseFloat(form.weight)    || 0,
        body_fat:     form.body_fat ? parseFloat(form.body_fat) : null,
        fitness_goal: form.fitness_goal,
      })
      setSaved(true)
      setTimeout(onClose, 600)
    } catch (e) {
      setErr(e?.message || tl('save_failed'))
    } finally {
      setSaving(false)
    }
  }

  const pill = (active) => ({
    flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none',
    background: active ? 'var(--accent)' : 'var(--surface2)',
    color: active ? '#fff' : 'var(--muted)',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
  })

  const numberInput = () => ({
    background: 'var(--surface2)', border: '1.5px solid var(--border)',
    borderRadius: 10, color: 'var(--text)', fontSize: 16, fontWeight: 600,
    fontFamily: 'inherit', padding: '10px 12px', width: '100%', boxSizing: 'border-box',
    outline: 'none',
  })

  const fieldLabel = {
    fontSize: 11, fontWeight: 800, color: 'var(--muted)',
    textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8, display: 'block',
  }

  const btnLabel = saved ? tl('saved_profile') : saving ? tl('saving_profile') : tl('save_profile')
  const btnReady = valid && !saving && !saved

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{
        position: 'relative', zIndex: 1,
        background: 'var(--surface)', borderRadius: '24px 24px 0 0',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Drag handle + header — fixed */}
        <div style={{ padding: '8px 20px 0', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)', margin: '12px auto 20px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{tl('your_profile')}</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer', padding: 4 }}>✕</button>
          </div>
        </div>

        {/* Scrollable form fields */}
        <div style={{ overflowY: 'auto', padding: '0 20px', flex: 1 }}>
          <div style={{ marginBottom: 20 }}>
            <span style={fieldLabel}>{tl('gender')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={pill(form.gender === 'male')}   onClick={() => set('gender', 'male')}>{tl('male')}</button>
              <button style={pill(form.gender === 'female')} onClick={() => set('gender', 'female')}>{tl('female')}</button>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <span style={fieldLabel}>{tl('height')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input type="number" inputMode="numeric" placeholder="5" value={form.height_ft} onChange={e => set('height_ft', e.target.value)} style={numberInput()} />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>ft</span>
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <input type="number" inputMode="numeric" placeholder="10" value={form.height_in} onChange={e => set('height_in', e.target.value)} style={numberInput()} />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>in</span>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <span style={fieldLabel}>{tl('cur_weight')}</span>
            <div style={{ position: 'relative' }}>
              <input type="number" inputMode="decimal" placeholder="170" value={form.weight} onChange={e => set('weight', e.target.value)} style={numberInput()} />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <span style={fieldLabel}>{tl('body_fat')} <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{tl('body_fat_opt')}</span></span>
            <div style={{ position: 'relative' }}>
              <input type="number" inputMode="decimal" placeholder="e.g. 18" value={form.body_fat} onChange={e => set('body_fat', e.target.value)} style={numberInput()} />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>%</span>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <span style={fieldLabel}>{tl('fitness_goal')}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={pill(form.fitness_goal === 'build_muscle')} onClick={() => set('fitness_goal', 'build_muscle')}>{tl('build_muscle')}</button>
              <button style={pill(form.fitness_goal === 'lose_fat')}     onClick={() => set('fitness_goal', 'lose_fat')}>{tl('lose_fat')}</button>
              <button style={pill(form.fitness_goal === 'maintain')}     onClick={() => set('fitness_goal', 'maintain')}>{tl('maintain')}</button>
            </div>
          </div>
        </div>

        {/* Save button — always visible at the bottom */}
        <div style={{ padding: '12px 20px 36px', flexShrink: 0, borderTop: '1px solid var(--border)' }}>
          {err && (
            <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10, textAlign: 'center' }}>{err}</div>
          )}
          <button onClick={save} disabled={!btnReady} style={{
            width: '100%', padding: 14, borderRadius: 14, border: 'none',
            background: saved ? '#22c55e' : btnReady ? 'var(--accent)' : 'var(--surface2)',
            color: btnReady || saved ? '#fff' : 'var(--muted)',
            fontSize: 15, fontWeight: 800, cursor: btnReady ? 'pointer' : 'default',
            transition: 'background 0.2s',
          }}>
            {btnLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AvatarPage({ profile, onSaveProfile, history = [], dayData = {}, customExercises = [] }) {
  const tl = useT()
  const [profileOpen, setProfileOpen] = useState(false)

  const mirror = useMemo(() => computeTrainingStats(history, dayData, customExercises), [history, dayData, customExercises])

  // Shared card style
  const card = {
    background: 'var(--surface)', borderRadius: 20,
    border: '1.5px solid var(--border)', marginBottom: 14,
    overflow: 'hidden',
  }

  const sectionLabel = {
    fontSize: 11, fontWeight: 800, color: 'var(--muted)',
    textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12,
  }

  const bigNumber = {
    fontSize: 38, fontWeight: 900, color: 'var(--text)',
    letterSpacing: '-1.5px', lineHeight: 1,
  }

  const metricLabel = {
    fontSize: 10, fontWeight: 700, color: 'var(--muted)',
    textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4,
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 0 32px' }}>

      {/* ── Training Mirror stats ── */}
      <div style={{ ...card, padding: '18px 16px' }}>
        <div style={sectionLabel}>{tl('training_mirror')}</div>

        {/* Volume + tier */}
        <div style={{ marginBottom: 20 }}>
          <div style={bigNumber}>{mirror.totalVolume.toLocaleString()}</div>
          <div style={metricLabel}>{tl('total_reps')}</div>

          {/* Tier scale */}
          <div style={{ marginTop: 16 }}>
            <TierScale tierIdx={mirror.tierIdx} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              {TIERS.map((tier, i) => (
                <div key={tier.id} style={{
                  fontSize: 9, fontWeight: i === mirror.tierIdx ? 800 : 600,
                  color: i === mirror.tierIdx ? 'var(--text)' : 'var(--muted)',
                  textAlign: 'center',
                  flex: 1,
                }}>
                  {tl('tier_' + tier.id)}
                </div>
              ))}
            </div>
            {mirror.nextTier && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                {tl('reps_to', { n: (mirror.nextTier.min - mirror.totalVolume).toLocaleString(), tier: tl('tier_' + mirror.nextTier.id) })}
              </div>
            )}
          </div>
        </div>

        {/* Three key metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
          <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: '12px 10px' }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px' }}>
              {mirror.streak}
            </div>
            <div style={metricLabel}>{tl('day_streak')}</div>
          </div>
          <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: '12px 10px' }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px' }}>
              {mirror.consistency28}%
            </div>
            <div style={metricLabel}>{tl('wk_pace')}</div>
          </div>
          <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: '12px 10px' }}>
            <div style={{
              fontSize: 26, fontWeight: 900, letterSpacing: '-1px',
              color: mirror.volTrend >= 0 ? '#22c55e' : '#f87171',
            }}>
              {`${mirror.volTrend > 0 ? '+' : ''}${mirror.volTrend}%`}
            </div>
            <div style={metricLabel}>{tl('vs_last')}</div>
          </div>
        </div>

        {/* 28-day dot grid */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div style={sectionLabel}>{tl('last_28')}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
              {mirror.activeDays28} / 28 {tl('sessions')}
            </div>
          </div>
          <ConsistencyGrid last28={mirror.last28} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>{tl('wks_ago')}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>{tl('today_label')}</div>
          </div>
        </div>

        {/* This week summary */}
        {(mirror.sessionsThisWeek > 0 || mirror.volumeThisWeek > 0) && (
          <div style={{
            marginTop: 14, padding: '10px 12px', borderRadius: 10,
            background: 'var(--surface2)', display: 'flex', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              {tl('this_week')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
              {mirror.sessionsThisWeek} {tl('sessions')} · {mirror.volumeThisWeek.toLocaleString()} {tl('reps')}
            </div>
          </div>
        )}
      </div>

      {/* ── Profile card ── */}
      <div style={{ ...card, padding: '18px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={sectionLabel}>{tl('profile_section')}</div>
          <button onClick={() => setProfileOpen(true)} style={{
            background: 'none', border: 'none', color: 'var(--accent)',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0,
          }}>{tl('edit')}</button>
        </div>
        {profile && profile.gender && profile.height_ft && profile.weight && profile.fitness_goal ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { label: tl('gender'),      value: profile.gender === 'male' ? tl('male') : tl('female') },
              { label: tl('height'),      value: `${profile.height_ft}ft ${profile.height_in || 0}in` },
              profile.body_fat ? { label: tl('body_fat'), value: `${profile.body_fat}%` } : null,
              { label: tl('goal_label'),  value: goalLabel(profile.fitness_goal, tl) },
            ].filter(Boolean).map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>{value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div onClick={() => setProfileOpen(true)} style={{
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            padding: '12px 14px', borderRadius: 12,
            background: 'linear-gradient(90deg, rgba(139,92,246,0.1), transparent)',
            border: '1px dashed var(--accent)',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{tl('complete_profile_cta')}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{tl('profile_cta_sub')}</div>
            </div>
            <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 16 }}>›</span>
          </div>
        )}
      </div>

      {profileOpen && (
        <ProfileSheet profile={profile} onSave={onSaveProfile} onClose={() => setProfileOpen(false)} />
      )}
    </div>
  )
}
