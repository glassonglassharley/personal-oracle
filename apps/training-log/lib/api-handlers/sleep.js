import { neon } from '@neondatabase/serverless'
import { getAuthenticatedUserId } from '../serverAuth.js'

export const config = { maxDuration: 15 }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Username-Auth, X-Username-Token')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' })
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' })

  const sql    = neon(process.env.DATABASE_URL)
  const userId = await getAuthenticatedUserId(req, sql)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const source = req.query?.source || 'oura'

  if (source === 'oura') {
    const configRows = await sql`
      SELECT data FROM training_logs WHERE user_id = ${userId} AND date = 'config' LIMIT 1
    `.catch(() => [])
    const pat = configRows[0]?.data?.ouraPAT
    if (!pat) return res.json({ connected: false, source: 'oura' })

    // Oura "day" is anchored to yesterday — sleep logged overnight belongs to the previous day
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const date = d.toISOString().slice(0, 10)

    try {
      const [sleepRes, dailyRes] = await Promise.all([
        fetch(`https://api.ouraring.com/v2/usercollection/sleep?start_date=${date}&end_date=${date}`, {
          headers: { Authorization: `Bearer ${pat}` },
        }),
        fetch(`https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${date}&end_date=${date}`, {
          headers: { Authorization: `Bearer ${pat}` },
        }),
      ])

      if (sleepRes.status === 401) {
        return res.json({ connected: false, source: 'oura', error: 'invalid_token' })
      }

      const [sleepBody, dailyBody] = await Promise.all([
        sleepRes.ok  ? sleepRes.json()  : Promise.resolve(null),
        dailyRes.ok  ? dailyRes.json()  : Promise.resolve(null),
      ])

      const sessions = sleepBody?.data || []
      const longSleep = sessions.find(s => s.type === 'long_sleep') || sessions[0] || null
      const daily     = dailyBody?.data?.[0] || null

      if (!longSleep && !daily) {
        return res.json({ connected: true, source: 'oura', data: null, date })
      }

      const totalSecs = longSleep?.total_sleep_duration || 0
      const hours     = totalSecs > 0 ? Math.round(totalSecs / 3600 * 4) / 4 : null

      return res.json({
        connected: true,
        source:    'oura',
        date,
        data: {
          hours,
          score:    daily?.score          ?? null,
          deepMin:  longSleep ? Math.round((longSleep.deep_sleep_duration  || 0) / 60) : null,
          remMin:   longSleep ? Math.round((longSleep.rem_sleep_duration   || 0) / 60) : null,
          lightMin: longSleep ? Math.round((longSleep.light_sleep_duration || 0) / 60) : null,
          awakeMin: longSleep ? Math.round((longSleep.awake_time           || 0) / 60) : null,
          hrv:      longSleep?.average_hrv ?? null,
        },
      })
    } catch (err) {
      console.error('[sleep/oura]', err?.message || err)
      return res.json({ connected: true, source: 'oura', data: null, error: 'fetch_failed' })
    }
  }

  return res.status(400).json({ error: 'Unknown source. Use ?source=oura' })
}
