// ── Progress Engine ───────────────────────────────────────────────────────────
// Pure functions — no React, no side effects.
// Feeds WorkoutRecap, ProgressDashboard, and eventually the avatar system.
//
// Reps are the main training unit.
// All functions are safe with empty/undefined inputs.

const SKIP = new Set(['steps', 'meals', 'water', 'date'])

export const EX_NAMES = {
  pushups: 'Push-ups',
  squats:  'Squats',
  situps:  'Sit-ups',
  pullups: 'Pull-ups',
  curls:   'Curls',
  bench:   'Bench Press',
}

const REP_IDS = ['pushups', 'squats', 'situps', 'pullups', 'curls', 'bench']
const TIMED_RECORDS = [
  { id: 'dead_hang', exercise: 'Dead Hang', keys: ['dead_hang'] },
  { id: 'planks', exercise: 'Plank', keys: ['planks', 'plank'] },
]

function repValue(day, id) {
  const raw = day?.[id]
  if (raw && typeof raw === 'object') return Number(raw.reps || 0)
  return Number(raw || 0)
}

function timedValue(day, keys = []) {
  for (const key of keys) {
    const value = Number(day?.[key] || 0)
    if (Number.isFinite(value) && value > 0) return value
  }
  return 0
}

const CUPS_PER_BOTTLE = 16.9 / 8

function fmtBottleRecord(cups) {
  const bottles = Number(cups || 0) / CUPS_PER_BOTTLE
  if (!Number.isFinite(bottles) || bottles <= 0) return '0 bottles'
  const rounded = Number(bottles.toFixed(bottles < 10 ? 1 : 0))
  return `${rounded.toLocaleString()} bottle${rounded === 1 ? '' : 's'}`
}

// ── Epley estimated 1-rep max ─────────────────────────────────────────────────

export function epley1RM(weight, reps) {
  if (!weight || !reps) return 0
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30))
}

// ── Legacy volume hook ───────────────────────────────────────────────────────
// Weight-based volume is intentionally disabled; reps are the main unit.

export function calcDayVolume() {
  return 0
}

// Total reps for one day

export function calcDayReps(dayData, customExercises = []) {
  if (!dayData) return 0
  let reps = 0
  for (const id of REP_IDS) reps += repValue(dayData, id)
  for (const ex of customExercises) {
    if (ex.type === 'reps' || ex.type === 'bench' || ex.type === 'weighted_reps') reps += repValue(dayData, ex.id)
  }
  return reps
}

// ── Weekly reps: this week vs last week ───────────────────────────────────────

export function calcWeeklyVolumes(history, todayData, customExercises = []) {
  const now     = new Date()
  const todayKey = now.toISOString().slice(0, 10)

  // ISO week — Monday = day 1
  function mondayOf(d) {
    const copy = new Date(d)
    const dow  = copy.getDay() || 7
    copy.setDate(copy.getDate() - (dow - 1))
    copy.setHours(0, 0, 0, 0)
    return copy
  }

  const thisMonday = mondayOf(now)
  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(lastMonday.getDate() - 7)

  // Count today's current data
  let thisWeek = calcDayReps(todayData, customExercises)
  let lastWeek = 0

  for (const day of history) {
    if (day.date === todayKey) continue
    const date = new Date(day.date + 'T12:00:00')
    const vol  = calcDayReps(day, customExercises)
    if (date >= thisMonday) thisWeek += vol
    else if (date >= lastMonday && date < thisMonday) lastWeek += vol
  }

  const changePercent = lastWeek > 0
    ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
    : null

  return { thisWeek, lastWeek, changePercent }
}

// ── PR detection ──────────────────────────────────────────────────────────────
// Returns array of { exercise, type, display, detail }
// type: 'weight' | 'reps' | 'set_volume' | '1rm'

export function detectPRs(dayData, history, customExercises = []) {
  if (!dayData || !history) return []
  const prs = []

  // ── Rep PR exercises ──
  for (const id of REP_IDS) {
    const today = repValue(dayData, id)
    if (today === 0) continue

    const past = history
      .map(d => repValue(d, id))
      .filter(v => v > 0)

    if (!past.length) continue

    const best = Math.max(...past)
    if (today > best) {
      prs.push({
        exercise: EX_NAMES[id],
        type:     'reps',
        display:  `${today} reps`,
        detail:   `prev best ${best}`,
      })
    }
  }

  // ── Custom reps exercises ──
  for (const ex of customExercises) {
    if (!['reps', 'bench', 'weighted_reps'].includes(ex.type)) continue
    const today = repValue(dayData, ex.id)
    if (today === 0) continue

    const past = history
      .map(d => repValue(d, ex.id))
      .filter(v => v > 0)

    if (!past.length) continue
    const best = Math.max(...past)
    if (today > best) {
      prs.push({ exercise: ex.name, type: 'reps', display: `${today} reps`, detail: `prev best ${best}` })
    }
  }

  return prs
}

// ── Per-exercise trends ───────────────────────────────────────────────────────
// Compares the most recent N sessions to the N before that.
// Returns map of exerciseId → 'up' | 'flat' | 'down' | null

export function calcExerciseTrends(history, customExercises = []) {
  const trends = {}
  const N = 3 // sessions per window

  function trend(sessions) {
    if (sessions.length < N * 2) return null
    const recent = sessions.slice(-N)
    const older  = sessions.slice(-N * 2, -N)
    const rAvg = recent.reduce((s, v) => s + v, 0) / N
    const oAvg = older.reduce((s, v) => s + v, 0) / N
    if (oAvg === 0) return null
    const pct = (rAvg - oAvg) / oAvg
    if (pct > 0.04)  return 'up'
    if (pct < -0.04) return 'down'
    return 'flat'
  }

  // Bodyweight + custom reps
  const repsLike = [
    ...REP_IDS.map(id => ({ id })),
    ...customExercises.filter(e => ['reps', 'bench', 'weighted_reps'].includes(e.type)),
  ]
  for (const { id } of repsLike) {
    const sessions = history
      .map(d => repValue(d, id))
      .filter(v => v > 0)
    trends[id] = trend(sessions)
  }

  return trends
}

// ── Workout streak (consecutive days with any logged reps or sets) ─────────────

export function calcStreak(history, dayData) {
  const todayKey = new Date().toISOString().slice(0, 10)

  function hasWork(d) {
    if (!d) return false
    if (d.rest === true) return true
    return REP_IDS.reduce((s, id) => s + repValue(d, id), 0) > 0
  }

  const byDate = {}
  for (const d of history) byDate[d.date] = d
  byDate[todayKey] = { ...dayData, date: todayKey }

  let streak = 0
  const cur = new Date()

  for (let i = 0; i < 365; i++) {
    const key = cur.toISOString().slice(0, 10)
    if (hasWork(byDate[key])) {
      streak++
      cur.setDate(cur.getDate() - 1)
    } else if (i === 0) {
      // Today not yet logged — still check yesterday
      cur.setDate(cur.getDate() - 1)
    } else {
      break
    }
  }

  return streak
}

// ── Sessions logged this week (Mon–today) ─────────────────────────────────────

export function calcWeekSessions(history, dayData) {
  const now      = new Date()
  const todayKey = now.toISOString().slice(0, 10)
  const dow      = now.getDay() || 7
  const monday   = new Date(now)
  monday.setDate(now.getDate() - (dow - 1))
  monday.setHours(0, 0, 0, 0)

  function hasWork(d) {
    if (!d) return false
    return REP_IDS.reduce((s, id) => s + repValue(d, id), 0) > 0
  }

  let count = hasWork(dayData) ? 1 : 0
  for (const day of history) {
    if (day.date === todayKey) continue
    const date = new Date(day.date + 'T12:00:00')
    if (date >= monday && hasWork(day)) count++
  }

  return count
}

// ── Legacy weight helpers ────────────────────────────────────────────────────

export function calcLastWeights() { return {} }

export function calcBestLiftThisWeek() { return null }

// ── Avatar stats — all five dimensions ───────────────────────────────────────
// Returns 0–100 scores ready to feed into avatar generation prompt.
// Does NOT depend on any React state.

export function calcAvatarStats(history, dayData, customExercises = []) {
  const streak       = calcStreak(history, dayData)
  const weekSessions = calcWeekSessions(history, dayData)
  const weekVol      = calcWeeklyVolumes(history, dayData, customExercises)
  const trends       = calcExerciseTrends(history, customExercises)
  const prs          = detectPRs(dayData, history, customExercises)

  const trendingUp   = Object.values(trends).filter(t => t === 'up').length
  const totalTrends  = Object.values(trends).filter(t => t !== null).length

  // Cumulative all-time volume (reps + weighted)
  let allTimeVol = 0
  for (const day of history) {
    allTimeVol += calcDayReps(day, customExercises)
  }

  return {
    // 0–100 rounded scores
    strength:   Math.min(100, Math.round((weekVol.thisWeek / 500) * 100)),
    discipline: Math.min(100, Math.round((streak / 21) * 100)),
    endurance:  Math.min(100, Math.round((weekSessions / 6) * 100)),
    mastery:    totalTrends > 0
      ? Math.min(100, Math.round((trendingUp / totalTrends) * 100))
      : 0,
    recovery:   Math.min(100, Math.max(0, Math.round(((7 - weekSessions) / 3) * 100))),

    // Raw data for avatar prompt text
    weeklyVolumeLb: 0,
    streak,
    weekSessions,
    prCount:   prs.length,
    allTimeVol,
    trendingUp,
  }
}

// ── All-time PRs per exercise ─────────────────────────────────────────────────
// Returns { [id]: { exercise, display, date, type } }

function fmtSecsRecord(s) {
  s = Math.round(s || 0)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (s < 3600) return rem === 0 ? `${m}m` : `${m}m ${rem}s`
  const h = Math.floor(m / 60)
  const mrem = m % 60
  return mrem === 0 ? `${h}h` : `${h}h ${mrem}m`
}

export function calcAllTimeRecords(history, dayData, customExercises = []) {
  const records = {}
  const todayKey = new Date().toISOString().slice(0, 10)
  const all = [...history, { ...dayData, date: todayKey }]

  for (const id of REP_IDS) {
    let best = null
    for (const day of all) {
      const v = repValue(day, id)
      if (v > 0 && (!best || v > best.reps)) {
        best = { reps: v, display: `${v} reps`, date: day.date, type: 'reps', exercise: EX_NAMES[id] }
      }
    }
    if (best) records[id] = best
  }

  for (const ex of customExercises) {
    if (!['reps', 'bench', 'weighted_reps'].includes(ex.type)) continue
    let best = null
    for (const day of all) {
      const v = repValue(day, ex.id)
      if (v > 0 && (!best || v > best.reps)) {
        best = { reps: v, display: `${v} reps`, date: day.date, type: 'reps', exercise: ex.name }
      }
    }
    if (best) records[ex.id] = best
  }

  for (const def of TIMED_RECORDS) {
    let best = null
    for (const day of all) {
      const v = timedValue(day, def.keys)
      if (v > 0 && (!best || v > best.val)) {
        best = { val: v, display: fmtSecsRecord(v), date: day.date, type: 'timed', exercise: def.exercise }
      }
    }
    if (best) records[def.id] = best
  }

  // Wellness — Steps
  {
    let best = null
    for (const day of all) {
      const v = typeof day.steps === 'number' ? day.steps : 0
      if (v > 0 && (!best || v > best.val)) {
        best = { val: v, display: `${v.toLocaleString()} steps`, date: day.date, type: 'steps', exercise: 'Steps' }
      }
    }
    if (best) records.steps = best
  }

  // Wellness — Meditation
  {
    let best = null
    for (const day of all) {
      const v = typeof day.meditation === 'number' ? day.meditation : 0
      if (v > 0 && (!best || v > best.val)) {
        best = { val: v, display: fmtSecsRecord(v), date: day.date, type: 'timed', exercise: 'Meditation' }
      }
    }
    if (best) records.meditation = best
  }

  // Wellness — Books
  {
    let best = null
    for (const day of all) {
      const v = typeof day.books === 'number' ? day.books : 0
      if (v > 0 && (!best || v > best.val)) {
        best = { val: v, display: `${v} session${v !== 1 ? 's' : ''}`, date: day.date, type: 'sessions', exercise: 'Books' }
      }
    }
    if (best) records.books = best
  }

  // Wellness — Water
  {
    let best = null
    for (const day of all) {
      const v = typeof day.water === 'number' ? day.water : 0
      if (v > 0 && (!best || v > best.val)) {
        best = { val: v, display: fmtBottleRecord(v), date: day.date, type: 'bottles', exercise: 'Water' }
      }
    }
    if (best) records.water = best
  }

  return records
}

// ── Master recap — single call for WorkoutRecap screen ───────────────────────

export function computeRecap(dayData, history, customExercises = []) {
  return {
    volume:       calcDayVolume(dayData, customExercises),
    reps:         calcDayReps(dayData, customExercises),
    prs:          detectPRs(dayData, history, customExercises),
    weeklyVol:    calcWeeklyVolumes(history, dayData, customExercises),
    trends:       calcExerciseTrends(history, customExercises),
    streak:       calcStreak(history, dayData),
    weekSessions: calcWeekSessions(history, dayData),
    lastWeights:  calcLastWeights(history, customExercises),
    bestLift:     calcBestLiftThisWeek(history, dayData, customExercises),
  }
}
