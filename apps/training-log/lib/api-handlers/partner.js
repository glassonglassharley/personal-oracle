import { neon } from '@neondatabase/serverless'
import { getAuthenticatedUserId } from '../serverAuth.js'

function dayReps(day) {
  if (!day) return 0
  let total = 0
  total += day.pushups    || 0
  total += day.squats     || 0
  total += day.situps     || 0
  total += day.pullups    || 0
  total += day.dead_hang  || 0
  total += day.curls      || 0
  total += day.bench?.reps || 0
  total += day.meditation || 0
  total += day.books      || 0
  for (const [k, v] of Object.entries(day)) {
    if (!k.startsWith('custom_')) continue
    if (typeof v === 'number') total += v
    else if (v?.reps) total += v.reps
  }
  return total
}

function calcStreak(history, todayData) {
  const byDate = {}
  for (const d of history) byDate[d.date] = dayReps(d) > 0
  const todayKey = new Date().toISOString().slice(0, 10)
  if (todayData) byDate[todayKey] = dayReps(todayData) > 0
  let streak = 0
  const cur = new Date()
  for (let i = 0; i < 365; i++) {
    const key = cur.toISOString().slice(0, 10)
    if (byDate[key]) { streak++; cur.setDate(cur.getDate() - 1) }
    else if (i > 0) break
    else cur.setDate(cur.getDate() - 1)
  }
  return streak
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Username-Auth, X-Username-Token')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' })
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' })

  const sql = neon(process.env.DATABASE_URL)

  // ── userId mode: follow-gated access (no token needed) ───────────────────
  if (req.query?.userId) {
    const requesterId = await getAuthenticatedUserId(req, sql)
    if (!requesterId) return res.status(401).json({ error: 'Unauthorized' })

    const targetId = req.query.userId

    // Check either direction — both parties in an accepted follow can view each other
    const followRows = await sql`
      SELECT 1 FROM follows
      WHERE (
        (requester_id = ${requesterId} AND target_id = ${targetId}) OR
        (requester_id = ${targetId}    AND target_id = ${requesterId})
      ) AND status = 'accepted'
      LIMIT 1
    `.catch(() => [])
    if (!followRows.length) return res.status(403).json({ error: 'Not following this user' })

    const configRows = await sql`
      SELECT data FROM training_logs WHERE user_id = ${targetId} AND date = 'config' LIMIT 1
    `
    // Partner exists but hasn't saved any config yet — return valid empty response
    if (!configRows.length) {
      return res.json({ username: null, sharing: {}, today: {}, history: [], streak: null, dailyTotal: null })
    }

    const config  = configRows[0].data
    const sharing = config.sharingSettings || {}
    const today   = new Date().toISOString().slice(0, 10)

    const [todayRows, historyRows] = await Promise.all([
      sql`SELECT data FROM training_logs WHERE user_id = ${targetId} AND date = ${today}`,
      sql`SELECT date, data FROM training_logs WHERE user_id = ${targetId}
          AND date != 'config' AND date != ${today}
          ORDER BY date DESC LIMIT 90`,
    ])

    const todayData = todayRows[0]?.data ?? {}
    const history   = historyRows.map(r => ({ date: r.date, ...r.data }))
    const knownKeys = ['pushups','squats','situps','pullups','curls','bench','steps','meals','water']
    const sharedToday = {}
    for (const key of knownKeys) {
      if (sharing[key] !== false && todayData[key] !== undefined) sharedToday[key] = todayData[key]
    }

    return res.json({
      username:    config.partnerUsername || config.profile?.username || null,
      sharing,
      today:       sharedToday,
      history:     sharing.history ? history : [],
      streak:      sharing.streak    ? calcStreak(history, todayData) : null,
      dailyTotal:  sharing.daily     ? dayReps(todayData)             : null,
    })
  }

  // ── Token mode: original share-link access ───────────────────────────────
  const token = req.query?.token
  if (!token) return res.status(400).json({ error: 'Missing token or userId' })

  const configRows = await sql`
    SELECT user_id, data FROM training_logs
    WHERE date = 'config' AND data->>'shareToken' = ${token}
    LIMIT 1
  `
  if (!configRows.length) return res.status(404).json({ error: 'Partner not found' })

  const { user_id, data: config } = configRows[0]
  const sharing = config.sharingSettings || {}
  const today = new Date().toISOString().slice(0, 10)

  const [todayRows, historyRows] = await Promise.all([
    sql`SELECT data FROM training_logs WHERE user_id = ${user_id} AND date = ${today}`,
    sql`SELECT date, data FROM training_logs WHERE user_id = ${user_id}
        AND date != 'config' AND date != ${today}
        ORDER BY date DESC LIMIT 90`,
  ])

  const todayData = todayRows[0]?.data ?? {}
  const history   = historyRows.map(r => ({ date: r.date, ...r.data }))

  const exerciseKeys = ['pushups','squats','situps','pullups','curls','bench','steps','meals','water']
  const sharedToday  = {}
  for (const key of exerciseKeys) {
    if (sharing[key] !== false && todayData[key] !== undefined) {
      sharedToday[key] = todayData[key]
    }
  }

  const streak     = calcStreak(history, todayData)
  const dailyTotal = dayReps(todayData)

  return res.json({
    userId:      user_id,
    username:    config.partnerUsername || config.profile?.username || null,
    sharing,
    today:      sharedToday,
    history:    sharing.history ? history : [],
    streak:     sharing.streak    ? streak     : null,
    dailyTotal: sharing.daily     ? dailyTotal : null,
  })
}
