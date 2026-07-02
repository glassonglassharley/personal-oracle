const BUILTIN_REP_DEFS = [
  { id: 'pushups', type: 'reps' },
  { id: 'squats', type: 'reps' },
  { id: 'situps', type: 'reps' },
  { id: 'pullups', type: 'reps' },
  { id: 'dips', type: 'reps' },
  { id: 'curls', type: 'reps' },
  { id: 'bench', type: 'reps' },
]

export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function repValue(day = {}, def = {}) {
  const value = day[def.id]
  if (value && typeof value === 'object') return Number(value.reps || 0)
  if (def.type === 'reps' || def.type === 'bench' || def.type === 'weighted_reps') return Number(value || 0)
  return 0
}

export function dayReps(day = {}, customExercises = []) {
  const defsById = new Map()
  for (const def of BUILTIN_REP_DEFS) defsById.set(def.id, def)
  for (const ex of customExercises || []) {
    if (!['reps', 'weighted_reps', 'bench'].includes(ex.type)) continue
    if (!defsById.has(ex.id)) defsById.set(ex.id, ex)
  }

  return [...defsById.values()].reduce((total, def) => {
    const n = repValue(day, def)
    return total + (Number.isFinite(n) && n > 0 ? n : 0)
  }, 0)
}

export function buildCumulativeRepSeries(history = [], dayData, customExercises = [], today = localDate()) {
  const byDate = new Map()

  for (const day of history) {
    if (!day?.date) continue
    byDate.set(day.date, dayReps(day, customExercises))
  }

  if (dayData) byDate.set(today, dayReps({ date: today, ...dayData }, customExercises))

  const dates = [...byDate.keys()].sort()
  if (!dates.length) return []

  const start = new Date(dates[0] + 'T00:00:00')
  const end = new Date(today + 'T00:00:00')
  const points = []
  let cumulative = 0

  for (const cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
    const date = localDate(cur)
    const day = byDate.get(date) || 0
    cumulative += day
    points.push({ date, value: cumulative, day })
  }

  return points
}
