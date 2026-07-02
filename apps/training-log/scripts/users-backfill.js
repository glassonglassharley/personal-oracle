import { neon } from '@neondatabase/serverless'
import { getAuthenticatedUserId } from '../lib/serverAuth.js'

export const config = { maxDuration: 30 }

export async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Username-Auth, X-Username-Token')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' })

  const sql = neon(process.env.DATABASE_URL)
  const userId = await getAuthenticatedUserId(req, sql)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  // Ensure tables exist
  await sql`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id     TEXT PRIMARY KEY,
      username    TEXT NOT NULL,
      share_token TEXT,
      updated_at  TIMESTAMPTZ DEFAULT now()
    )
  `
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_lower_idx
    ON user_profiles (LOWER(username))
  `

  // Read all config rows that have a partnerUsername set
  const configs = await sql`
    SELECT user_id, data
    FROM training_logs
    WHERE date = 'config'
      AND data->>'partnerUsername' IS NOT NULL
      AND LENGTH(TRIM(data->>'partnerUsername')) >= 3
    LIMIT 1000
  `

  let synced = 0
  let skipped = 0

  for (const row of configs) {
    const username   = String(row.data.partnerUsername || '').trim()
    const shareToken = row.data.shareToken || null
    if (!username || username.length < 3) continue
    try {
      await sql`
        INSERT INTO user_profiles (user_id, username, share_token, updated_at)
        VALUES (${row.user_id}, ${username}, ${shareToken}, now())
        ON CONFLICT (user_id)
        DO UPDATE SET
          username    = ${username},
          share_token = ${shareToken},
          updated_at  = now()
      `
      synced++
    } catch {
      // username uniqueness conflict — another user already has this name; skip
      skipped++
    }
  }

  // Also sync users who registered via username-token auth (their username lives in username_auth_users)
  const usernameAuthUsers = await sql`
    SELECT user_id, username FROM username_auth_users
    WHERE LENGTH(TRIM(username)) >= 3
    LIMIT 1000
  `.catch(() => [])

  for (const row of usernameAuthUsers) {
    const uname = String(row.username || '').trim()
    if (!uname || uname.length < 3) continue
    try {
      await sql`
        INSERT INTO user_profiles (user_id, username, share_token, updated_at)
        VALUES (${row.user_id}, ${uname}, null, now())
        ON CONFLICT (user_id)
        DO UPDATE SET
          username   = EXCLUDED.username,
          updated_at = now()
      `
      synced++
    } catch {
      skipped++
    }
  }

  return res.json({ ok: true, synced, skipped, total: configs.length + usernameAuthUsers.length })
}
