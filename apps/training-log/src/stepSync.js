export function numericSteps(value) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function reconcileStepData(today, week = [], localToday = 0, { todayDate = localDateKey() } = {}) {
  const resolvedToday = Math.max(numericSteps(today), numericSteps(localToday))
  const byDate = new Map((week || []).map(d => [d.date, { ...d, steps: numericSteps(d.steps) }]))
  const current = byDate.get(todayDate) || { date: todayDate, steps: 0 }
  byDate.set(todayDate, { ...current, steps: Math.max(numericSteps(current.steps), resolvedToday) })
  return {
    today: resolvedToday,
    week: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
  }
}

export function reconcileGoogleFitStepData(today, week = [], { todayDate = localDateKey() } = {}) {
  const resolvedToday = numericSteps(today)
  const byDate = new Map((week || []).map(d => [d.date, { ...d, steps: numericSteps(d.steps) }]))
  const current = byDate.get(todayDate) || { date: todayDate, steps: 0 }
  byDate.set(todayDate, { ...current, steps: resolvedToday })
  return {
    today: resolvedToday,
    week: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
  }
}

export function displayStepsForStatus({ status, todaySteps, localSteps }) {
  return status === 'ready' ? numericSteps(todaySteps) : numericSteps(localSteps)
}
