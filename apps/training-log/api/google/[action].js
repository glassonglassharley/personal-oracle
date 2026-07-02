import { neon } from '@neondatabase/serverless'
import { getAuthenticatedUserId } from '../../lib/serverAuth.js'

export const config = { maxDuration: 30 }

const APP_URL      = 'https://training-log-flax.vercel.app'
const REDIRECT_URI = `${APP_URL}/api/google/callback`
const SCOPES       = 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.sleep.read'

async function ensureGoogleTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS google_fit_tokens (
      id            uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id       text         NOT NULL UNIQUE,
      access_token  text         NOT NULL,
      refresh_token text         NOT NULL,
      expires_at    bigint       NOT NULL,
      created_at    timestamptz  DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS daily_steps (
      id         uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id    text         NOT NULL,
      date       text         NOT NULL,
      steps      integer      DEFAULT 0,
      source     text         DEFAULT 'google_fit',
      updated_at timestamptz  DEFAULT now(),
      UNIQUE (user_id, date)
    )
  `
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

// Sentinel: token row exists but is permanently expired/revoked (invalid_grant)
const TOKEN_EXPIRED = 'TOKEN_EXPIRED'

async function getValidAccessToken(sql, userId) {
  const rows = await sql`
    SELECT access_token, refresh_token, expires_at
    FROM google_fit_tokens WHERE user_id = ${userId}
  `
  if (!rows[0]) return null
  let { access_token, refresh_token, expires_at } = rows[0]
  if (Date.now() > expires_at - 60000) {
    if (!refresh_token) return TOKEN_EXPIRED
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token,
        client_id:     process.env.GOOGLE_FIT_CLIENT_ID,
        client_secret: process.env.GOOGLE_FIT_CLIENT_SECRET,
        grant_type:    'refresh_token',
      }),
    })
    if (!r.ok) {
      const errBody = await r.json().catch(() => ({}))
      console.error('[google_fit] token refresh failed:', JSON.stringify(errBody))
      if (errBody.error === 'invalid_grant') {
        // Token permanently revoked (e.g. Testing-mode 7-day expiry, user revoked access).
        // Delete the stale row so the user gets a clean reconnect card immediately.
        await sql`DELETE FROM google_fit_tokens WHERE user_id = ${userId}`.catch(() => {})
        return TOKEN_EXPIRED
      }
      return null
    }
    const refreshed = await r.json()
    if (!refreshed.access_token) {
      console.error('[google_fit] token refresh returned no access_token:', JSON.stringify(refreshed))
      return null
    }
    access_token = refreshed.access_token
    expires_at   = Date.now() + (refreshed.expires_in * 1000)
    await sql`
      UPDATE google_fit_tokens SET access_token = ${access_token}, expires_at = ${expires_at}
      WHERE user_id = ${userId}
    `
  }
  return access_token
}

const APP_TIME_ZONE = 'America/Los_Angeles'

function appDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value
    return acc
  }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}

function timeZoneOffsetMs(date, timeZone = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value
    return acc
  }, {})
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  )
  return asUTC - date.getTime()
}

function zonedMidnightUtcMs(dateKey, timeZone = APP_TIME_ZONE) {
  const utcMidnight = Date.parse(dateKey + 'T00:00:00Z')
  let offset = timeZoneOffsetMs(new Date(utcMidnight), timeZone)
  let result = utcMidnight - offset
  offset = timeZoneOffsetMs(new Date(result), timeZone)
  result = utcMidnight - offset
  return result
}

function addDateKeyDays(dateKey, days) {
  const date = new Date(dateKey + 'T12:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function appToday() {
  return appDateKey()
}

function numericSteps(value) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

function sumStepBuckets(fitData) {
  // Google Fit normalises bucketByTime boundaries to UTC midnight regardless of
  // the startTimeMillis we send.  Using startTimeMillis therefore mis-dates every
  // bucket (e.g. UTC 2026-06-25T00:00Z → LA "2026-06-24").  Use the bucket
  // midpoint instead: noon UTC always maps to the correct calendar date in any
  // US timezone (max offset is UTC-8, noon UTC = 4am local — still same date).
  const byDate = new Map()
  for (const bucket of fitData.bucket || []) {
    const startMs = parseInt(bucket.startTimeMillis) || 0
    const endMs   = parseInt(bucket.endTimeMillis)   || (startMs + 86400000)
    const midMs   = startMs + Math.floor((endMs - startMs) / 2)
    const date    = appDateKey(new Date(midMs))
    const steps   = (bucket.dataset || []).flatMap(d => d.point || [])
      .reduce((sum, p) => sum + (p.value?.[0]?.intVal || 0), 0)
    byDate.set(date, (byDate.get(date) || 0) + steps)
  }
  return [...byDate.entries()].map(([date, steps]) => ({ date, steps }))
}

function totalSteps(rows = []) {
  return rows.reduce((sum, row) => sum + numericSteps(row.steps), 0)
}

async function fetchGoogleStepBuckets(accessToken, startMs, endMs, days = 7) {
  const requests = [
    { aggregateBy: [{ dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps' }] },
    { aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }] },
  ]
  let best = []
  let hadOkResponse = false
  for (const base of requests) {
    const fitRes = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        ...base,
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: startMs,
        endTimeMillis: endMs,
      }),
    })
    if (!fitRes.ok) continue
    hadOkResponse = true
    const rows = sumStepBuckets(await fitRes.json())
    if (totalSteps(rows) > totalSteps(best)) best = rows
  }
  return { ok: hadOkResponse, week: best }
}

async function upsertTrainingLogSteps(sql, userId, date, steps, { overwrite = false } = {}) {
  const safeSteps = numericSteps(steps)
  const existing = await sql`SELECT data FROM training_logs WHERE user_id = ${userId} AND date = ${date}`
  if (!existing[0] && date !== appToday()) return
  const currentData = existing[0]?.data ?? {}
  const resolvedSteps = overwrite ? safeSteps : Math.max(numericSteps(currentData.steps), safeSteps)
  const merged = JSON.stringify({ ...currentData, steps: resolvedSteps })
  await sql`
    INSERT INTO training_logs (user_id, date, data, updated_at)
    VALUES (${userId}, ${date}, ${merged}::jsonb, now())
    ON CONFLICT (user_id, date)
    DO UPDATE SET data = ${merged}::jsonb, updated_at = now()
  `
}

// GET /api/google/auth — build Google OAuth URL
async function handleAuth(req, res, sql) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!process.env.GOOGLE_FIT_CLIENT_ID) return res.status(500).json({ error: 'GOOGLE_FIT_CLIENT_ID not configured' })
  const userId = await getAuthenticatedUserId(req, sql)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  if (userId.startsWith('username:')) return res.status(400).json({ error: 'Google Fit requires a Google/Clerk account.' })
  const state = Buffer.from(userId).toString('base64url')
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', process.env.GOOGLE_FIT_CLIENT_ID)
  url.searchParams.set('redirect_uri', REDIRECT_URI)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', state)
  return res.json({ url: url.toString() })
}

// GET /api/google/callback — OAuth token exchange (redirected from Google)
async function handleCallback(req, res, sql) {
  const { code, state, error } = req.query
  if (error) return res.redirect(`${APP_URL}?google_error=${encodeURIComponent(error)}`)
  if (!code || !state) return res.redirect(`${APP_URL}?google_error=missing_params`)
  let userId
  try {
    userId = Buffer.from(state, 'base64url').toString('utf8')
    if (!userId || !userId.startsWith('user_')) throw new Error('invalid')
  } catch {
    return res.redirect(`${APP_URL}?google_error=invalid_state`)
  }
  if (!process.env.GOOGLE_FIT_CLIENT_ID || !process.env.GOOGLE_FIT_CLIENT_SECRET) {
    return res.redirect(`${APP_URL}?google_error=server_config`)
  }
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id:     process.env.GOOGLE_FIT_CLIENT_ID,
      client_secret: process.env.GOOGLE_FIT_CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
    }),
  })
  if (!tokenRes.ok) {
    console.error('Token exchange failed:', await tokenRes.text())
    return res.redirect(`${APP_URL}?google_error=token_exchange_failed`)
  }
  const { access_token, refresh_token, expires_in } = await tokenRes.json()
  if (!access_token) return res.redirect(`${APP_URL}?google_error=no_access_token`)
  const expires_at = Date.now() + (expires_in * 1000)
  await ensureGoogleTables(sql)
  if (refresh_token) {
    await sql`
      INSERT INTO google_fit_tokens (user_id, access_token, refresh_token, expires_at)
      VALUES (${userId}, ${access_token}, ${refresh_token}, ${expires_at})
      ON CONFLICT (user_id) DO UPDATE SET
        access_token  = ${access_token},
        refresh_token = ${refresh_token},
        expires_at    = ${expires_at}
    `
  } else {
    await sql`
      INSERT INTO google_fit_tokens (user_id, access_token, refresh_token, expires_at)
      VALUES (${userId}, ${access_token}, '', ${expires_at})
      ON CONFLICT (user_id) DO UPDATE SET
        access_token = ${access_token},
        expires_at   = ${expires_at}
    `
  }
  return res.redirect(`${APP_URL}?connected=true`)
}

// GET /api/google/steps — fetch + sync last 7 days from Google Fit
async function handleSteps(req, res, sql) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const userId = await getAuthenticatedUserId(req, sql)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  await ensureGoogleTables(sql).catch(() => {})
  const accessToken = await getValidAccessToken(sql, userId).catch(() => null)
  if (accessToken === TOKEN_EXPIRED) return res.json({ connected: false, reason: 'token_expired' })
  if (!accessToken) return res.json({ connected: false, reason: 'not_connected' })
  // Align buckets to Los Angeles calendar days, including daylight saving time.
  const today = appToday()
  const startMs = zonedMidnightUtcMs(addDateKeyDays(today, -6))
  const endMs   = zonedMidnightUtcMs(addDateKeyDays(today, 1))
  const result = await fetchGoogleStepBuckets(accessToken, startMs, endMs, 7)
  if (!result.ok) {
    console.error('[google_fit] all step aggregate requests failed')
    return res.json({ connected: false, reason: 'fit_api_error' })
  }
  const week = result.week
  await Promise.all(week.map(async ({ date, steps }) => {
    const safeSteps = numericSteps(steps)
    // Google Fit is authoritative — overwrite any previously cached value so stale
    // numbers from old syncs or other sources don't persist after a fresh resync.
    await sql`
      INSERT INTO daily_steps (user_id, date, steps, source, updated_at)
      VALUES (${userId}, ${date}, ${safeSteps}, 'google_fit', now())
      ON CONFLICT (user_id, date)
      DO UPDATE SET steps = ${safeSteps}, source = 'google_fit', updated_at = now()
    `
    await upsertTrainingLogSteps(sql, userId, date, safeSteps, { overwrite: true })
  }))
  // Return Google Fit data directly — no DB re-merge so stale cached values can't inflate the result.
  const sortedWeek = [...week].sort((a, b) => a.date.localeCompare(b.date))
  const todayEntry = sortedWeek.find(d => d.date === today)
  return res.json({ today: todayEntry?.steps || 0, week: sortedWeek, connected: true })
}

// POST /api/google/backfill — fetch up to 365 days from Google Fit and store
async function handleBackfill(req, res, sql) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const userId = await getAuthenticatedUserId(req, sql)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  await ensureGoogleTables(sql).catch(() => {})
  const accessToken = await getValidAccessToken(sql, userId).catch(() => null)
  if (accessToken === TOKEN_EXPIRED) return res.json({ connected: false, reason: 'token_expired' })
  if (!accessToken) return res.json({ connected: false })

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch {} }
  const days = Math.min(365, Math.max(7, parseInt(body?.days || '365')))

  const today = appToday()
  const endMs   = zonedMidnightUtcMs(addDateKeyDays(today, 1))
  const startMs = zonedMidnightUtcMs(addDateKeyDays(today, -(days - 1)))

  const result = await fetchGoogleStepBuckets(accessToken, startMs, endMs, days)
  if (!result.ok) return res.json({ connected: false, error: 'Google Fit API error' })

  let synced = 0
  await Promise.all(result.week.map(async ({ date, steps }) => {
    if (steps <= 0) return
    const safeSteps = numericSteps(steps)
    synced++
    await sql`
      INSERT INTO daily_steps (user_id, date, steps, source, updated_at)
      VALUES (${userId}, ${date}, ${safeSteps}, 'google_fit', now())
      ON CONFLICT (user_id, date)
      DO UPDATE SET steps = ${safeSteps}, source = 'google_fit', updated_at = now()
    `.catch(() => {})
    await upsertTrainingLogSteps(sql, userId, date, safeSteps, { overwrite: true }).catch(() => {})
  }))

  return res.json({ ok: true, synced, days })
}

// GET /api/google/sleep — last night's sleep segments from Google Fit
async function handleSleep(req, res, sql) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const userId = await getAuthenticatedUserId(req, sql)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  await ensureGoogleTables(sql).catch(() => {})
  const accessToken = await getValidAccessToken(sql, userId).catch(() => null)
  if (accessToken === TOKEN_EXPIRED) return res.json({ connected: false, reason: 'token_expired' })
  if (!accessToken) return res.json({ connected: false })

  // Query 36 hours back so sleep spanning midnight is captured
  const endMs   = Date.now()
  const startMs = endMs - 36 * 60 * 60 * 1000

  const fitRes = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      aggregateBy:  [{ dataTypeName: 'com.google.sleep.segment' }],
      bucketByTime: { durationMillis: 36 * 60 * 60 * 1000 },
      startTimeMillis: startMs,
      endTimeMillis:   endMs,
    }),
  })

  // 403 = no sleep scope yet → prompt re-auth
  if (!fitRes.ok) {
    return res.json({ connected: fitRes.status !== 401, needsReauth: fitRes.status === 403 })
  }

  const fitData = await fitRes.json()

  // Sleep segment type codes from Google Fit
  // 2/72 = generic sleep, 4 = light, 5 = deep, 6 = REM; 1 = awake, 3 = out of bed (excluded)
  const SLEEP_TYPES = new Set([2, 4, 5, 6, 72])
  let totalMs = 0, deepMs = 0, remMs = 0, lightMs = 0

  for (const bucket of fitData.bucket || []) {
    for (const dataset of bucket.dataset || []) {
      for (const point of dataset.point || []) {
        const type = point.value?.[0]?.intVal
        const dur  = (parseInt(point.endTimeNanos || 0) - parseInt(point.startTimeNanos || 0)) / 1e6
        if (!SLEEP_TYPES.has(type) || dur <= 0) continue
        totalMs += dur
        if (type === 5) deepMs  += dur
        else if (type === 6) remMs += dur
        else lightMs += dur  // 2, 4, 72
      }
    }
  }

  const hours = totalMs > 0 ? Math.round(totalMs / 3600000 * 4) / 4 : null

  return res.json({
    connected: true,
    hours,
    deepMin:  Math.round(deepMs  / 60000),
    remMin:   Math.round(remMs   / 60000),
    lightMin: Math.round(lightMs / 60000),
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Username-Auth, X-Username-Token')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' })

  const sql    = neon(process.env.DATABASE_URL)
  const action = req.query.action

  try {
    if (action === 'auth')      return await handleAuth(req, res, sql)
    if (action === 'callback')  return await handleCallback(req, res, sql)
    if (action === 'steps')     return await handleSteps(req, res, sql)
    if (action === 'sleep')     return await handleSleep(req, res, sql)
    if (action === 'backfill')  return await handleBackfill(req, res, sql)
    return res.status(404).json({ error: 'Not found' })
  } catch (err) {
    console.error(`[google/${action}] unhandled error:`, err?.message || err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
