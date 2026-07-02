// Health bridge — unified interface over Health Connect (Android) and HealthKit (iOS).
// Install the native plugin first:
//   npm install @capacitor-community/health
// If the plugin is not installed, all methods return safe defaults (isAvailable → false).

let Health = null

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function loadPlugin() {
  if (Health) return Health
  try {
    const mod = await import('@capacitor-community/health')
    Health = mod.Health
  } catch {
    Health = null
  }
  return Health
}

export const HealthBridge = {
  async isAvailable() {
    const h = await loadPlugin()
    if (!h) return false
    try {
      const { available } = await h.isAvailable()
      return available
    } catch { return false }
  },

  async requestPermissions() {
    const h = await loadPlugin()
    if (!h) throw new Error('Health plugin not installed')
    await h.requestAuthorization({ read: ['steps'], write: [] })
  },

  async getTodaySteps() {
    const h = await loadPlugin()
    if (!h) return 0
    const now   = new Date()
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const result = await h.queryAggregated({
      startDate: start.toISOString(),
      endDate:   now.toISOString(),
      dataType:  'steps',
      bucket:    'day',
    })
    return result?.[0]?.value || 0
  },

  async getWeekSteps() {
    const h = await loadPlugin()
    if (!h) return []
    const now   = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 6)
    start.setHours(0, 0, 0, 0)
    const result = await h.queryAggregated({
      startDate: start.toISOString(),
      endDate:   now.toISOString(),
      dataType:  'steps',
      bucket:    'day',
    })
    return result.map(r => ({
      date:  localDateKey(new Date(r.startDate)),
      steps: r.value || 0,
    }))
  },

  async getHistorySteps(days = 365) {
    const h = await loadPlugin()
    if (!h) return []
    const now   = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    start.setHours(0, 0, 0, 0)
    try {
      const result = await h.queryAggregated({
        startDate: start.toISOString(),
        endDate:   now.toISOString(),
        dataType:  'steps',
        bucket:    'day',
      })
      return (result || [])
        .filter(r => r.value > 0)
        .map(r => ({ date: localDateKey(new Date(r.startDate)), steps: r.value || 0 }))
    } catch { return [] }
  },

  async requestSleepPermissions() {
    const h = await loadPlugin()
    if (!h) throw new Error('Health plugin not installed')
    await h.requestAuthorization({ read: ['steps', 'sleep'], write: [] })
  },

  // Returns hours slept last night (0 if unavailable / plugin absent)
  async getLastNightSleep() {
    const h = await loadPlugin()
    if (!h) return 0
    // Window: 6pm yesterday → now, covers typical overnight sleep
    const now   = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 1)
    start.setHours(18, 0, 0, 0)
    try {
      await h.requestAuthorization({ read: ['steps', 'sleep'], write: [] })
      const result = await h.query({
        startDate: start.toISOString(),
        endDate:   now.toISOString(),
        dataType:  'sleep',
      })
      if (!result?.length) return 0
      const totalMs = result.reduce((sum, r) => {
        const s = new Date(r.startDate).getTime()
        const e = new Date(r.endDate).getTime()
        return sum + (e > s ? e - s : 0)
      }, 0)
      return Math.round(totalMs / 3600000 * 4) / 4
    } catch { return 0 }
  },
}
