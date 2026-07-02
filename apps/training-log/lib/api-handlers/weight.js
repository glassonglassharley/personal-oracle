import { neon } from '@neondatabase/serverless'
import { getAuthenticatedUserId } from '../serverAuth.js'

export const config = { maxDuration: 10 }

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS body_weight (
      id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id     TEXT NOT NULL,
      date        TEXT NOT NULL,
      weight_lbs  NUMERIC(5,1) NOT NULL,
      notes       TEXT,
      logged_at   TIMESTAMPTZ DEFAULT now(),
      UNIQUE (user_id, date)
    )
  `
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Username-Auth, X-Username-Token')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' })
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' })

  const sql = neon(process.env.DATABASE_URL)
  const userId = await getAuthenticatedUserId(req, sql)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  await ensureTable(sql)

  if (req.method === 'GET') {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const rows = await sql`
      SELECT date, weight_lbs, notes
      FROM body_weight
      WHERE user_id = ${userId} AND date >= ${cutoffStr}
      ORDER BY date ASC
    `
    return res.json({
      entries: rows.map(r => ({
        date:       r.date,
        weight_lbs: parseFloat(r.weight_lbs),
        notes:      r.notes || '',
      })),
    })
  }

  const { date, weight_lbs, notes = '' } = req.body || {}
  if (!date || !weight_lbs || parseFloat(weight_lbs) <= 0) {
    return res.status(400).json({ error: 'date and weight_lbs required' })
  }
  await sql`
    INSERT INTO body_weight (user_id, date, weight_lbs, notes)
    VALUES (${userId}, ${date}, ${parseFloat(weight_lbs)}, ${notes})
    ON CONFLICT (user_id, date) DO UPDATE
      SET weight_lbs = EXCLUDED.weight_lbs,
          notes      = EXCLUDED.notes,
          logged_at  = now()
  `
  return res.json({ ok: true })
}
