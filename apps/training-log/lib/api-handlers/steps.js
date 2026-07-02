import { neon } from '@neondatabase/serverless'
import { getAuthenticatedUserId } from '../serverAuth.js'

export const config = { maxDuration: 10 }

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS daily_steps (
      id         uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id    text         NOT NULL,
      date       text         NOT NULL,
      steps      integer      DEFAULT 0,
      source     text         DEFAULT 'healthkit',
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

async function upsertTrainingLogSteps(sql, userId, date, steps) {
  const safeSteps = numericSteps(steps)
  const existing = await sql`
    SELECT data FROM training_logs WHERE user_id = ${userId} AND date = ${date}
  `
  if (!existing[0] && date !== appToday()) return
  const currentData = existing[0]?.data ?? {}
  const merged = JSON.stringify({ ...currentData, steps: Math.max(numericSteps(currentData.steps), safeSteps) })
  await sql`
    INSERT INTO training_logs (user_id, date, data, updated_at)
    VALUES (${userId}, ${date}, ${merged}::jsonb, now())
    ON CONFLICT (user_id, date)
    DO UPDATE SET data = ${merged}::jsonb, updated_at = now()
  `
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Username-Auth, X-Username-Token')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' })

  const sql = neon(process.env.DATABASE_URL)
  const userId = await getAuthenticatedUserId(req, sql)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  await ensureTable(sql)

  // ── GET: full history ────────────────────────────────────────────────────────
  if (req.method === 'GET' && req.query.history === '1') {
    const [stepRows, logRows] = await Promise.all([
      sql`
        SELECT date, steps FROM daily_steps
        WHERE user_id = ${userId} AND steps > 0
        ORDER BY date ASC
      `,
      sql`
        SELECT date, data FROM training_logs
        WHERE user_id = ${userId} AND date != 'config'
        ORDER BY date ASC
      `,
    ])
    const byDate = new Map()
    for (const r of stepRows) byDate.set(r.date, numericSteps(r.steps))
    for (const r of logRows) {
      const logged = numericSteps(r.data?.steps)
      if (logged > 0) byDate.set(r.date, Math.max(byDate.get(r.date) || 0, logged))
    }
    return res.json({
      history: [...byDate.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, steps]) => ({ date, steps })),
    })
  }

  // ── GET: last 7 days ─────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const today = appToday()

    const dates = []
    for (let i = 6; i >= 0; i--) {
      dates.push(addDateKeyDays(today, -i))
    }

    const [stepRows, logRows] = await Promise.all([
      sql`
        SELECT date, steps, source
        FROM daily_steps
        WHERE user_id = ${userId} AND date >= ${dates[0]}
        ORDER BY date ASC
      `,
      sql`
        SELECT date, data
        FROM training_logs
        WHERE user_id = ${userId} AND date >= ${dates[0]} AND date != 'config'
      `,
    ])

    const byDate = {}
    for (const r of stepRows) byDate[r.date] = { steps: numericSteps(r.steps), source: r.source }
    for (const r of logRows) {
      const current = byDate[r.date]
      const loggedSteps = numericSteps(r.data?.steps)
      byDate[r.date] = {
        steps: Math.max(current?.steps || 0, loggedSteps),
        source: current?.source || 'training_log',
      }
    }

    const week = dates.map(date => ({
      date,
      steps: byDate[date]?.steps || 0,
      source: byDate[date]?.source || null,
    }))

    return res.json({ today: byDate[today]?.steps || 0, week })
  }

  // ── POST ─────────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    let body = req.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid JSON' }) }
    }

    const { date, steps, source = 'healthkit' } = body || {}
    if (!date || steps == null) return res.status(400).json({ error: 'Missing date or steps' })

    const safeSteps = numericSteps(steps)
    await sql`
      INSERT INTO daily_steps (user_id, date, steps, source, updated_at)
      VALUES (${userId}, ${date}, ${safeSteps}, ${source}, now())
      ON CONFLICT (user_id, date)
      DO UPDATE SET steps = GREATEST(daily_steps.steps, ${safeSteps}), source = ${source}, updated_at = now()
    `
    await upsertTrainingLogSteps(sql, userId, date, safeSteps)

    return res.json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
