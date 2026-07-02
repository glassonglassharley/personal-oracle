import { neon } from '@neondatabase/serverless'
import { getAuthenticatedUserId } from '../lib/serverAuth.js'

const TODAY_PT = (offsetDays = 0) => {
  const base = offsetDays === 0 ? new Date() : (() => { const d = new Date(); d.setDate(d.getDate() + offsetDays); return d })()
  return base.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

const DATE_PT = (date = new Date()) => date.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

const CUPS_PER_BOTTLE = 16.9 / 8
const ML_PER_CUP = 236.588

function displayTime(date = new Date()) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function roundQuarterHours(ms) {
  const hours = ms / 36e5
  return Math.max(0, Math.round(hours * 4) / 4)
}

// ── Exercise aliases ──────────────────────────────────────────────────────────

const ALIASES = {
  pushups: ['pushups', 'push-ups', 'push ups', 'pushup', 'push-up', 'push up', 'pressups', 'press-ups', 'press ups'],
  squats:  ['squats', 'squat'],
  situps:  ['situps', 'sit-ups', 'sit ups', 'situp', 'sit-up', 'crunches', 'crunch'],
  pullups: ['pullups', 'pull-ups', 'pull ups', 'pullup', 'pull-up', 'chin ups', 'chin-ups'],
  dips:    ['dips', 'dip', 'tricep dips', 'triceps dips', 'bench dips', 'log dips', 'log dip', 'log tricep dips', 'log triceps dips', 'log bench dips'],
  curls:   ['curls', 'curl', 'bicep curls', 'bicep curl', 'biceps curls', 'dumbbell curls', 'dumbell curls', 'dumbbell curl', 'dumbell curl'],
  bench:   ['bench', 'bench press', 'benchpress'],
  dead_hang: ['dead hang', 'dead hangs', 'deadhang', 'deadhangs', 'hang', 'hangs', 'deadhanging', 'hanging', 'log deadhang', 'log dead hang', 'log dead hangs', 'log deadhangs', 'log deadhanging', 'log hanging'],
  planks:  ['plank', 'planks', 'forearm plank', 'forearm planks'],
  steps:   ['steps', 'step count', 'walking', 'step'],
  meals:   ['meal', 'meals', 'food', 'ate', 'eat', 'eating'],
  water:   [
    'water',
    'hydration',
    'hydrate',
    'drink water',
    'log water',
    'how much water',
    'how much water did i drink',
    'how much water did you drink',
  ],
}

const DISPLAY = {
  pushups: 'push-ups', squats: 'squats', situps: 'sit-ups',
  pullups: 'pull-ups', dips: 'dips', curls: 'curls', bench: 'bench press',
  dead_hang: 'seconds of dead hang', planks: 'seconds of plank',
  steps: 'steps', meals: 'meal', water: 'cups of water',
}

const SESSION_CATEGORIES = {
  sleep:      { id: 'sleep', label: 'sleep', logType: 'sleep' },
  meditation: { id: 'meditation', label: 'meditation', exercise: 'meditation' },
  plank:      { id: 'planks', label: 'plank', exercise: 'planks' },
  planks:     { id: 'planks', label: 'plank', exercise: 'planks' },
  dead_hang:  { id: 'dead_hang', label: 'dead hang', exercise: 'dead_hang' },
  deadhang:   { id: 'dead_hang', label: 'dead hang', exercise: 'dead_hang' },
  hang:       { id: 'dead_hang', label: 'dead hang', exercise: 'dead_hang' },
}

function resolveSessionCategory(raw) {
  const key = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[-\s]+/g, '_')
  return SESSION_CATEGORIES[key] || null
}

function formatDuration(seconds, category) {
  const safe = Math.max(0, Math.round(Number(seconds) || 0))
  if (category === 'sleep') {
    const hours = Math.floor(safe / 3600)
    const minutes = Math.round((safe % 3600) / 60)
    if (hours && minutes) return `${hours}h ${minutes}m`
    if (hours) return `${hours}h`
    return `${minutes}m`
  }
  const minutes = Math.floor(safe / 60)
  const secs = safe % 60
  return minutes ? `${minutes}m ${secs}s` : `${secs}s`
}

function resolveExercise(raw) {
  const normalized = raw.toLowerCase().trim()
  for (const [id, aliases] of Object.entries(ALIASES)) {
    if (aliases.includes(normalized)) return id
  }
  return null
}

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS training_logs (
      user_id    TEXT NOT NULL,
      date       TEXT NOT NULL,
      data       JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, date)
    )
  `
}

async function ensureVoiceEventsTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS voice_events (
      user_id    TEXT NOT NULL,
      date       TEXT NOT NULL,
      event_key  TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, date, event_key)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS voice_events_created_at_idx ON voice_events (created_at)`
}

async function ensureVoiceSessionsTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS voice_sessions (
      user_id    TEXT NOT NULL,
      category   TEXT NOT NULL,
      start_at   TIMESTAMPTZ NOT NULL,
      start_date TEXT NOT NULL,
      text       TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, category)
    )
  `
}

function normalizeVoiceText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function voiceIdempotencyKey({ exercise, value, mode, text, now = Date.now() }) {
  const bucket = Math.floor(now / 10000) // suppress accidental duplicate shortcut submits within 10s
  return [exercise, mode || 'add', Number(value), normalizeVoiceText(text), bucket].join('|')
}

// ── Natural language parser ────────────────────────────────────────────────

const WORD_NUMS = {
  one:'1', two:'2', three:'3', four:'4', five:'5', six:'6', seven:'7',
  eight:'8', nine:'9', ten:'10', eleven:'11', twelve:'12', thirteen:'13',
  fourteen:'14', fifteen:'15', sixteen:'16', seventeen:'17', eighteen:'18',
  nineteen:'19', twenty:'20', thirty:'30', forty:'40', fifty:'50',
  sixty:'60', seventy:'70', eighty:'80', ninety:'90', hundred:'100',
}

const NUMBER_WORDS = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred'
const NUMBER_WORD_RE = new RegExp(`\\b(${NUMBER_WORDS})\\b`, 'gi')

function normalizeNumberWords(raw) {
  return String(raw || '').replace(NUMBER_WORD_RE, w => WORD_NUMS[w.toLowerCase()] || w)
}

function parseWaterAmount(raw) {
  const s = String(raw || '')
    .replace(/[  ​﻿]/g, ' ')
    .replace(/\bhalf\b/gi, '0.5')
    .replace(/\ba\b|\ban\b/gi, '1')
    .replace(NUMBER_WORD_RE, w => WORD_NUMS[w.toLowerCase()] || w)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  const amount = s.match(/(\d+(?:\.\d+)?)/)
  if (!amount) return null
  const n = Number(amount[1])
  if (!Number.isFinite(n) || n <= 0) return null

  let cups = null
  if (/\b(?:bottles?|water bottles?)\b/.test(s)) cups = n * CUPS_PER_BOTTLE
  else if (/\b(?:cups?|glasses?)\b/.test(s)) cups = n
  else if (/\b(?:fl\s*)?(?:oz|ounces?)\b/.test(s)) cups = n / 8
  else if (/\b(?:liters?|litres?|l)\b/.test(s)) cups = (n * 1000) / ML_PER_CUP
  else if (/\b(?:milliliters?|millilitres?|ml)\b/.test(s)) cups = n / ML_PER_CUP
  else if (/\b(?:water|hydration|hydrate|drink|drank)\b/.test(s)) cups = n

  if (cups == null) return null
  return Math.round(cups * 10) / 10
}

function parseDurationSeconds(raw) {
  const s = String(raw || '')
    .replace(/[  ​﻿]/g, ' ')
    .replace(/\bhalf\b/gi, '0.5')
    .replace(/\ba\b|\ban\b/gi, '1')
    .replace(NUMBER_WORD_RE, w => WORD_NUMS[w.toLowerCase()] || w)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  const explicit = s.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)\b/)
  if (explicit) {
    const n = Number(explicit[1])
    if (!Number.isFinite(n) || n <= 0) return null
    const unit = explicit[2]
    if (/^h/.test(unit)) return Math.round(n * 3600)
    if (/^m/.test(unit)) return Math.round(n * 60)
    return Math.round(n)
  }

  const amount = s.match(/(\d+(?:\.\d+)?)/)
  if (!amount) return null
  const n = Number(amount[1])
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

function parseForReps(raw, namesPattern) {
  const s = String(raw || '')
  const patterns = [
    new RegExp(`(?:${namesPattern})\\s+\\d+\\s+(?:for|x|by)\\s*(\\d+)`),
    new RegExp(`\\d+\\s+(?:${namesPattern})\\s+(?:for|x|by)\\s*(\\d+)`),
    new RegExp(`(?:${namesPattern})\\s+(\\d+)`),
    new RegExp(`(\\d+)\\s+(?:${namesPattern})`),
  ]
  for (const re of patterns) {
    const match = s.match(re)
    if (match) return Number(match[1])
  }
  return null
}

function parseTextInput(raw) {
  const s = raw.replace(/[  ​﻿]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  const d = normalizeNumberWords(s)

  // Sleep/wake intents must be detected before numeric exercise parsing because
  // voice shortcuts often send plain text like "good night" or "log wake time".
  if (/\b(bedtime|bed time|log bedtime|log bed time|record bedtime|record bed time|going to bed|go to bed|headed to bed|in bed|sleep time|going to sleep|go to sleep|start sleep|start sleep log|begin sleep|begin sleep log|sleep log start|good night|night night)\b/.test(d)) {
    return { kind: 'sleep', action: 'bed' }
  }
  if (/\b(wake time|log wake|log wake time|record wake|record wake time|woke up|wake up|waking up|i'?m awake|im awake|up now|got up|out of bed|stop sleep|stop sleep log|end sleep|end sleep log|finish sleep|finish sleep log|sleep log end|good morning)\b/.test(d)) {
    return { kind: 'sleep', action: 'wake' }
  }

  const sessionPhrase = d.match(/\b(start|begin|stop|end|finish)\s+(meditation|plank|planks|dead\s+hang|dead\s+hangs|deadhang|hang)\b/)
  if (sessionPhrase) {
    return {
      kind: 'session',
      mode: /^(start|begin)$/.test(sessionPhrase[1]) ? 'start' : 'stop',
      category: sessionPhrase[2].replace(/\s+/g, '_'),
    }
  }

  const waterAmount = parseWaterAmount(d)
  if (waterAmount != null && /\b(water|hydration|hydrate|drink|drank|bottles?|cups?|glasses?|ounces?|oz|liters?|litres?|ml)\b/.test(d)) {
    return { exercise: 'water', value: waterAmount, mode: 'add' }
  }

  const timedValue = parseDurationSeconds(d)
  if (/dead[- ]?hang(?:s|ing)?|dead hangs?|deadhangs?|deadhanging|\bhang(?:s|ing)?\b/.test(d) && timedValue != null) {
    return { exercise: 'dead_hang', value: timedValue, mode: 'add' }
  }
  if (/\b(?:forearm )?planks?\b/.test(d) && timedValue != null) {
    return { exercise: 'planks', value: timedValue, mode: 'add' }
  }

  const benchReps = parseForReps(d, 'bench[- ]?(?:press)?|benchpress')
  if (benchReps != null) return { exercise: 'bench', value: benchReps, mode: 'add' }
  const squatReps = parseForReps(d, 'squats?')
  if (squatReps != null) return { exercise: 'squats', value: squatReps, mode: 'add' }
  const dipReps = parseForReps(d, '(?:triceps? |bench )?dips?')
  if (dipReps != null) return { exercise: 'dips', value: dipReps, mode: 'add' }

  const numM = d.match(/(\d+)/)
  if (!numM) return null
  const num = Number(numM[1])

  if (/push[- ]?ups?|press[- ]?ups?/.test(d)) return { exercise: 'pushups', value: num, mode: 'add' }
  if (/squats?/.test(d))                   return { exercise: 'squats',  value: num, mode: 'add' }
  if (/sit[- ]?ups?|crunches?/.test(d))    return { exercise: 'situps',  value: num, mode: 'add' }
  if (/pull[- ]?ups?|chin[- ]?ups?/.test(d)) return { exercise: 'pullups', value: num, mode: 'add' }
  if (/(?:triceps? |bench )?dips?/.test(d)) return { exercise: 'dips', value: num, mode: 'add' }
  if (/bench[- ]?press|benchpress|\bbench\b/.test(d)) return { exercise: 'bench', value: num, mode: 'add' }
  const curlReps = d.match(/(?:dumbbells?|dumbells?|biceps?)?\s*curls?\s+\d+\s+(?:for|x)\s*(\d+)/)
    || d.match(/\d+\s+(?:dumbbells?|dumbells?|biceps?)?\s*curls?\s+(?:for|x)\s*(\d+)/)
  if (curlReps) return { exercise: 'curls', value: Number(curlReps[1]), mode: 'add' }
  if (/curls?|biceps?/.test(d))            return { exercise: 'curls',   value: num, mode: 'add' }
  if (/steps?|walked|walking/.test(d))     return { exercise: 'steps',   value: num, mode: 'add' }
  if (/water|hydration|hydrate|drink|drank|bottles?|cups?|glasses?/.test(d)) {
    const cups = parseWaterAmount(d)
    if (cups != null) return { exercise: 'water', value: cups, mode: 'add' }
  }

  return null
}

async function handleSleepVoice({ sql, userId, action, text, date }) {
  const now = new Date()
  const nowIso = now.toISOString()
  const today = (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : TODAY_PT()

  if (action === 'bed') {
    const rows = await sql`SELECT data FROM training_logs WHERE user_id = ${userId} AND date = ${today}`
    const day = rows[0]?.data ?? {}
    const sleepLog = Array.isArray(day.sleepLog) ? day.sleepLog : []
    const openIndex = sleepLog.findIndex(s => s?.bedAt && !s?.wakeAt)
    const session = {
      id: openIndex >= 0 ? sleepLog[openIndex].id || crypto.randomUUID() : crypto.randomUUID(),
      bedAt: nowIso,
      bedTime: displayTime(now),
      wakeAt: null,
      wakeTime: null,
      durationHours: null,
      text: text || null,
      source: 'voice',
      ...(openIndex >= 0 ? { overwrittenAt: nowIso } : {}),
    }
    const nextSleepLog = openIndex >= 0
      ? sleepLog.map((item, idx) => idx === openIndex ? session : item)
      : [...sleepLog, session]
    const nextDay = {
      ...day,
      sleepLog: nextSleepLog,
      sleepBedAt: nowIso,
      sleepWakeAt: null,
    }
    const payload = JSON.stringify(nextDay)
    await sql`
      INSERT INTO training_logs (user_id, date, data, updated_at)
      VALUES (${userId}, ${today}, ${payload}::jsonb, now())
      ON CONFLICT (user_id, date)
      DO UPDATE SET data = ${payload}::jsonb, updated_at = now()
    `
    return {
      ok: true,
      exercise: 'sleep',
      action: 'bed',
      date: today,
      sleepSession: session,
      message: openIndex >= 0
        ? `Restarted bedtime at ${session.bedTime}. Previous open sleep session was overwritten.`
        : `Logged bedtime at ${session.bedTime}.`,
    }
  }

  if (action === 'wake') {
    const candidateDates = [today, TODAY_PT(-1)]
    const rows = await sql`
      SELECT date, data FROM training_logs
      WHERE user_id = ${userId} AND date IN (${candidateDates[0]}, ${candidateDates[1]})
    `
    const byDate = new Map(rows.map(row => [row.date, row.data ?? {}]))
    let targetDate = null
    let targetDay = null
    let targetIndex = -1

    for (const candidate of candidateDates) {
      const day = byDate.get(candidate) ?? {}
      const sleepLog = Array.isArray(day.sleepLog) ? day.sleepLog : []
      const idx = [...sleepLog].reverse().findIndex(s => s?.bedAt && !s?.wakeAt)
      if (idx !== -1) {
        targetDate = candidate
        targetDay = day
        targetIndex = sleepLog.length - 1 - idx
        break
      }
    }

    if (!targetDay) {
      targetDate = today
      targetDay = byDate.get(today) ?? {}
    }

    const sleepLog = Array.isArray(targetDay.sleepLog) ? [...targetDay.sleepLog] : []
    let durationHours = null
    if (targetIndex >= 0) {
      const session = { ...sleepLog[targetIndex] }
      durationHours = roundQuarterHours(now.getTime() - new Date(session.bedAt).getTime())
      session.wakeAt = nowIso
      session.wakeTime = displayTime(now)
      session.durationHours = durationHours
      session.wakeText = text || null
      sleepLog[targetIndex] = session
    } else {
      sleepLog.push({
        id: crypto.randomUUID(),
        bedAt: null,
        bedTime: null,
        wakeAt: nowIso,
        wakeTime: displayTime(now),
        durationHours: null,
        text: text || null,
        source: 'voice',
      })
    }

    const nextDay = {
      ...targetDay,
      sleepLog,
      sleepWakeAt: nowIso,
      ...(durationHours != null ? { sleepHours: durationHours } : {}),
    }
    const payload = JSON.stringify(nextDay)
    await sql`
      INSERT INTO training_logs (user_id, date, data, updated_at)
      VALUES (${userId}, ${targetDate}, ${payload}::jsonb, now())
      ON CONFLICT (user_id, date)
      DO UPDATE SET data = ${payload}::jsonb, updated_at = now()
    `
    return {
      ok: true,
      exercise: 'sleep',
      action: 'wake',
      date: targetDate,
      total: durationHours,
      message: durationHours != null
        ? `Logged wake time at ${displayTime(now)}. Sleep duration: ${durationHours} hours.`
        : `Logged wake time at ${displayTime(now)}. No open bedtime was found to calculate duration.`,
    }
  }

  return { ok: false, error: 'Unknown sleep action' }
}

async function appendTimedSessionEntry({ sql, userId, exercise, label, seconds, startAt, stopAt, startText, stopText, date }) {
  const today = (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : DATE_PT(new Date(startAt))
  const rows = await sql`SELECT data FROM training_logs WHERE user_id = ${userId} AND date = ${today}`
  const day = rows[0]?.data ?? {}
  const currentRaw = day[exercise]
  const currentValue = typeof currentRaw === 'object' && currentRaw !== null ? Number(currentRaw.reps || 0) : Number(currentRaw ?? 0)
  const cur = Number.isFinite(currentValue) && currentValue > 0 ? currentValue : 0
  const num = Math.max(1, Math.round(Number(seconds) || 0))
  const entries = Array.isArray(day.entries) ? day.entries : []
  const priorExerciseEntries = entries.filter(e => e?.exercise === exercise && Number.isFinite(Number(e?.value)))
  const baselineEntry = priorExerciseEntries.length === 0 && cur > 0
    ? [{
        id: crypto.randomUUID(),
        exercise,
        value: cur,
        mode: 'baseline',
        text: 'Existing total before session tracking',
        at: null,
        timestamp: Date.now(),
        source: 'carryover',
      }]
    : []
  const entry = {
    id: crypto.randomUUID(),
    exercise,
    value: num,
    mode: 'add',
    text: stopText || startText || `Voice ${label} session`,
    at: displayTime(new Date(stopAt)),
    timestamp: new Date(stopAt).getTime(),
    source: 'voice-session',
    startedAt: startAt,
    stoppedAt: stopAt,
    durationSeconds: num,
  }
  day.entries = [...entries, ...baselineEntry, entry]
  day[exercise] = cur + num
  const payload = JSON.stringify(day)
  await sql`
    INSERT INTO training_logs (user_id, date, data, updated_at)
    VALUES (${userId}, ${today}, ${payload}::jsonb, now())
    ON CONFLICT (user_id, date)
    DO UPDATE SET data = ${payload}::jsonb, updated_at = now()
  `
  return { date: today, total: day[exercise], entry }
}

async function handleTimedVoiceSession({ sql, userId, category, mode, text }) {
  const def = resolveSessionCategory(category)
  if (!def) return { ok: false, error: `Unknown session category: ${category}` }
  const normalizedMode = String(mode || '').toLowerCase().trim()
  const now = new Date()
  const nowIso = now.toISOString()

  if (normalizedMode === 'start') {
    const existing = await sql`
      SELECT start_at FROM voice_sessions
      WHERE user_id = ${userId} AND category = ${def.id}
      LIMIT 1
    `
    await sql`
      INSERT INTO voice_sessions (user_id, category, start_at, start_date, text, updated_at)
      VALUES (${userId}, ${def.id}, ${nowIso}, ${DATE_PT(now)}, ${text || null}, now())
      ON CONFLICT (user_id, category)
      DO UPDATE SET start_at = ${nowIso}, start_date = ${DATE_PT(now)}, text = ${text || null}, updated_at = now()
    `
    return {
      ok: true,
      action: 'start',
      category: def.id,
      startedAt: nowIso,
      warning: existing.length ? `Replaced the previous open ${def.label} session.` : null,
      message: existing.length
        ? `Restarted ${def.label} at ${displayTime(now)}. Previous open session was overwritten.`
        : `Started ${def.label} at ${displayTime(now)}.`,
    }
  }

  if (normalizedMode !== 'stop') return { ok: false, error: 'Session mode must be start or stop.' }

  const rows = await sql`
    SELECT start_at, start_date, text FROM voice_sessions
    WHERE user_id = ${userId} AND category = ${def.id}
    LIMIT 1
  `
  const open = rows[0]
  if (!open) {
    return {
      ok: false,
      category: def.id,
      error: `No active ${def.label} session was found. Say “start ${def.label}” first.`,
    }
  }

  const startAt = new Date(open.start_at)
  const seconds = Math.max(1, Math.round((now.getTime() - startAt.getTime()) / 1000))
  await sql`DELETE FROM voice_sessions WHERE user_id = ${userId} AND category = ${def.id}`

  if (def.logType === 'sleep') {
    const result = await handleSleepVoice({
      sql,
      userId,
      action: 'wake',
      text: text || `End ${def.label}`,
      date: open.start_date,
    })
    return {
      ...result,
      action: 'stop',
      category: def.id,
      durationSeconds: seconds,
      durationDisplay: formatDuration(seconds, 'sleep'),
      message: `Ended ${def.label} at ${displayTime(now)}. Duration: ${formatDuration(seconds, 'sleep')}.`,
    }
  }

  const saved = await appendTimedSessionEntry({
    sql,
    userId,
    exercise: def.exercise,
    label: def.label,
    seconds,
    startAt: startAt.toISOString(),
    stopAt: nowIso,
    startText: open.text,
    stopText: text,
    date: open.start_date,
  })
  return {
    ok: true,
    action: 'stop',
    category: def.id,
    exercise: def.exercise,
    date: saved.date,
    durationSeconds: seconds,
    durationDisplay: formatDuration(seconds, def.id),
    total: saved.total,
    message: `Ended ${def.label} at ${displayTime(now)}. Duration: ${formatDuration(seconds, def.id)}. Total today: ${formatDuration(saved.total, def.id)}.`,
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Username-Auth, X-Username-Token, x-log-secret')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' })

  if (!process.env.DATABASE_URL)     return res.status(500).json({ error: 'DATABASE_URL not configured' })

  // Support x-log-secret for Siri shortcuts (voice token lookup in DB)
  const sql = neon(process.env.DATABASE_URL)
  await ensureTable(sql)
  await ensureVoiceEventsTable(sql)
  await ensureVoiceSessionsTable(sql)
  let userId = null

  const voiceSecret = req.headers['x-log-secret']
  if (voiceSecret) {
    // Find the user who owns this voice token
    const rows = await sql`
      SELECT user_id FROM training_logs
      WHERE date = 'config' AND data->>'voiceToken' = ${voiceSecret}
      LIMIT 1
    `
    userId = rows[0]?.user_id ?? null
  } else {
    userId = await getAuthenticatedUserId(req, sql)
  }

  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid JSON' }) }
  }

  let { exercise: rawExercise, category: rawCategory, mode = 'add', value, weight, reps, text, date, action: rawAction } = body || {}
  mode = String(mode || 'add').toLowerCase().trim()
  rawAction = rawAction ? String(rawAction).toLowerCase().trim() : ''
  console.log('[voice] raw body', JSON.stringify(body || {}))

  const sessionMode = rawAction === 'session_start' || rawAction === 'start_session' || rawAction === 'start' || mode === 'start'
    ? 'start'
    : rawAction === 'session_stop' || rawAction === 'stop_session' || rawAction === 'stop' || rawAction === 'end' || mode === 'stop' || mode === 'end'
      ? 'stop'
      : null
  const sessionCategory = rawCategory || rawExercise
  if (sessionMode && sessionCategory && resolveSessionCategory(sessionCategory)) {
    if (resolveSessionCategory(sessionCategory)?.logType === 'sleep' && sessionMode === 'start') {
      const sleepResult = await handleSleepVoice({ sql, userId, action: 'bed', text: text ? String(text) : 'Start sleep', date })
      const sessionResult = await handleTimedVoiceSession({ sql, userId, category: sessionCategory, mode: 'start', text: text ? String(text) : 'Start sleep' })
      return res.status(sessionResult.ok ? 200 : 400).json({ ...sessionResult, sleepSession: sleepResult.sleepSession })
    }
    const result = await handleTimedVoiceSession({ sql, userId, category: sessionCategory, mode: sessionMode, text: text ? String(text) : '' })
    return res.status(result.ok ? 200 : 400).json(result)
  }

  // If no exercise field, try parsing a natural language text field
  if (!rawExercise && text) {
    const parsed = parseTextInput(String(text))
    if (parsed?.kind === 'sleep') {
      const result = await handleSleepVoice({ sql, userId, action: parsed.action, text: String(text), date })
      return res.status(result.ok ? 200 : 400).json(result)
    }
    if (parsed?.kind === 'session') {
      const result = await handleTimedVoiceSession({ sql, userId, category: parsed.category, mode: parsed.mode, text: String(text) })
      return res.status(result.ok ? 200 : 400).json(result)
    }
    if (parsed) {
      rawExercise = parsed.exercise
      if (parsed.value  != null) value  = parsed.value
      if (parsed.weight != null) weight = parsed.weight
      if (parsed.reps   != null) reps   = parsed.reps
      if (parsed.mode)           mode   = parsed.mode
    }
  }

  if (rawExercise && /^(sleep|bed|bedtime|wake|wakeup)$/i.test(String(rawExercise))) {
    const parsedText = text ? parseTextInput(String(text)) : null
    const explicit = /wake/.test(rawAction) || /wake/.test(mode)
      ? 'wake'
      : /bed|sleep|start/.test(rawAction) || /bed|sleep|start/.test(mode)
        ? 'bed'
        : null
    const action = parsedText?.kind === 'sleep'
      ? parsedText.action
      : explicit || (/^wake/i.test(String(rawExercise)) ? 'wake' : 'bed')
    const result = await handleSleepVoice({ sql, userId, action, text: text ? String(text) : '', date })
    return res.status(result.ok ? 200 : 400).json(result)
  }

  if (!rawExercise) return res.status(400).json({ error: 'Missing exercise. Send { exercise, value }, { text: "30 push-ups" }, or { text: "going to bed" }.' })

  const exId = resolveExercise(String(rawExercise))
  if (!exId) return res.status(400).json({ error: `Unknown exercise: ${rawExercise}` })

  if (exId === 'water' && value == null && reps == null && text) {
    const cups = parseWaterAmount(text)
    if (cups != null) value = cups
  }

  const today = (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : TODAY_PT()

  const rows = await sql`SELECT data FROM training_logs WHERE user_id = ${userId} AND date = ${today}`
  const day  = rows[0]?.data ?? {}

  let message, updatedValue

  if (exId === 'meals') {
    const meals = Array.isArray(day.meals) ? day.meals : []
    const meal = {
      id: crypto.randomUUID(),
      text: text || 'Meal',
      at: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      calories: 0, protein: 0, carbs: 0, fat: 0,
      quality: null, emoji: '🍽️', photo: null,
      timestamp: Date.now(), source: 'voice', notes: '', components: null,
    }
    day.meals = [...meals, meal]
    const count = day.meals.length
    message = text
      ? `Logged: ${text}. Meal count today: ${count}.`
      : `Logged a meal. Meal count today: ${count}.`
    updatedValue = day.meals

  } else {
    const currentRaw = day[exId]
    const currentValue = typeof currentRaw === 'object' && currentRaw !== null ? Number(currentRaw.reps || 0) : Number(currentRaw ?? 0)
    const cur = Number.isFinite(currentValue) && currentValue > 0 ? currentValue : 0
    const rawValue = value ?? reps
    const num = Number(rawValue)
    console.log('[voice] parsed value', JSON.stringify({
      exercise: exId,
      mode,
      current: day[exId],
      currentParsed: cur,
      value,
      reps,
      rawValue,
      parsedValue: num
    }))
    if (!Number.isFinite(num) || num <= 0) {
      return res.status(400).json({
        error: 'Invalid value',
        received: rawValue,
        message: 'Please provide a positive number.',
        body
      })
    }

    const eventKey = voiceIdempotencyKey({ exercise: exId, value: num, mode, text })
    const inserted = await sql`
      INSERT INTO voice_events (user_id, date, event_key)
      VALUES (${userId}, ${today}, ${eventKey})
      ON CONFLICT (user_id, date, event_key) DO NOTHING
      RETURNING event_key
    `
    if (inserted.length === 0) {
      const existingTotal = typeof day[exId] === 'object' && day[exId] !== null
        ? Number(day[exId].reps || 0)
        : Number(day[exId] || 0)
      return res.json({
        ok: true,
        duplicate: true,
        exercise: exId,
        total: Number.isFinite(existingTotal) ? existingTotal : 0,
        message: `Already logged ${num.toLocaleString()} ${DISPLAY[exId]} a moment ago. Total today unchanged.`,
      })
    }

    const entries = Array.isArray(day.entries) ? day.entries : []
    const entry = {
      id: crypto.randomUUID(),
      exercise: exId,
      value: num,
      mode,
      text: text || null,
      at: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      timestamp: Date.now(),
      source: 'voice',
    }
    const priorExerciseEntries = entries.filter(e => e?.exercise === exId && Number.isFinite(Number(e?.value)))
    const baselineEntry = priorExerciseEntries.length === 0 && mode === 'add' && cur > 0
      ? [{
          id: crypto.randomUUID(),
          exercise: exId,
          value: cur,
          mode: 'baseline',
          text: 'Existing total before entry tracking',
          at: null,
          timestamp: Date.now(),
          source: 'carryover',
        }]
      : []
    day.entries = [...entries, ...baselineEntry, entry]

    day[exId] = mode === 'add' ? cur + num : num
    if (exId === 'squats') delete day.squatsWeight
    if (exId === 'curls') delete day.curlsWeight
    updatedValue = day[exId]
    const verb = mode === 'add' ? 'Added' : 'Set'
    message = `${verb} ${num.toLocaleString()} ${DISPLAY[exId]}. Total today: ${day[exId].toLocaleString()}.`
  }

  const d = JSON.stringify(day)
  await sql`
    INSERT INTO training_logs (user_id, date, data, updated_at)
    VALUES (${userId}, ${today}, ${d}::jsonb, now())
    ON CONFLICT (user_id, date)
    DO UPDATE SET data = ${d}::jsonb, updated_at = now()
  `

  return res.json({ ok: true, exercise: exId, total: updatedValue, message })
}
