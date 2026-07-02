import { neon } from '@neondatabase/serverless'
import { getAuthenticatedUserId, normalizeUsername } from '../../lib/serverAuth.js'

export const config = { maxDuration: 10 }

function parseList(value) {
  return String(value || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
}

function maskUserId(id) {
  if (!id) return null
  if (id.length <= 12) return id
  return `${id.slice(0, 8)}…${id.slice(-4)}`
}

async function isAdmin(req, userId) {
  const adminIds = parseList(process.env.TRAINING_LOG_ADMIN_USER_IDS)
  const adminUsernames = parseList(process.env.TRAINING_LOG_ADMIN_USERNAMES).map(normalizeUsername)
  const headerUsername = normalizeUsername(req.headers['x-username-auth'])

  if (adminIds.includes(userId)) return true
  if (headerUsername && adminUsernames.includes(headerUsername)) return true
  return false
}

async function ensureAdminTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS training_logs (
      user_id    TEXT NOT NULL,
      date       TEXT NOT NULL,
      data       JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, date)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS username_auth_users (
      username     text PRIMARY KEY,
      token_hash   text NOT NULL UNIQUE,
      user_id      text NOT NULL UNIQUE,
      created_at   timestamptz DEFAULT now(),
      last_seen_at timestamptz DEFAULT now()
    )
  `
}

async function listAdminUsers(sql, userId) {
  const rows = await sql`
    WITH all_users AS (
      SELECT user_id FROM training_logs
      UNION
      SELECT user_id FROM user_profiles
      UNION
      SELECT user_id FROM username_auth_users
    ), log_stats AS (
      SELECT
        user_id,
        COUNT(*) FILTER (WHERE date != 'config')::int AS log_days,
        MAX(updated_at) FILTER (WHERE date != 'config') AS last_log_at,
        MAX(updated_at) AS last_seen_at
      FROM training_logs
      GROUP BY user_id
    )
    SELECT
      au.user_id,
      up.username AS profile_username,
      uau.username AS username_auth,
      uau.created_at AS username_created_at,
      uau.last_seen_at AS username_last_seen_at,
      ls.log_days,
      ls.last_log_at,
      ls.last_seen_at
    FROM all_users au
    LEFT JOIN user_profiles up ON up.user_id = au.user_id
    LEFT JOIN username_auth_users uau ON uau.user_id = au.user_id
    LEFT JOIN log_stats ls ON ls.user_id = au.user_id
    ORDER BY COALESCE(ls.last_seen_at, uau.last_seen_at, uau.created_at) DESC NULLS LAST, au.user_id
    LIMIT 500
  `

  return {
    currentUserId: userId,
    count: rows.length,
    users: rows.map(row => ({
      userId: row.user_id,
      maskedUserId: maskUserId(row.user_id),
      username: row.profile_username || row.username_auth || null,
      authType: row.username_auth ? 'username' : 'clerk',
      joinedAt: row.username_created_at || null,
      lastSeenAt: row.username_last_seen_at || row.last_seen_at || null,
      lastLogAt: row.last_log_at || null,
      logDays: row.log_days || 0,
      isYou: row.user_id === userId,
    })),
  }
}

async function ensureTables(sql) {
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
  await sql`
    CREATE TABLE IF NOT EXISTS username_auth_users (
      username     text PRIMARY KEY,
      token_hash   text NOT NULL UNIQUE,
      user_id      text NOT NULL UNIQUE,
      created_at   timestamptz DEFAULT now(),
      last_seen_at timestamptz DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS follows (
      id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      requester_id TEXT NOT NULL,
      target_id    TEXT NOT NULL,
      status       TEXT DEFAULT 'pending'
                   CHECK (status IN ('pending', 'accepted', 'declined')),
      created_at   TIMESTAMPTZ DEFAULT now(),
      updated_at   TIMESTAMPTZ DEFAULT now(),
      UNIQUE (requester_id, target_id)
    )
  `
}

// Sync users not yet in user_profiles: catches username-auth users + any training_logs
// configs that predate the per-request sync. Runs in parallel with the search query;
// uses LEFT JOIN to skip already-indexed users so it becomes a no-op once everyone's caught up.
async function runBackfill(sql) {
  const [authUsers, configs] = await Promise.all([
    sql`
      SELECT u.user_id, u.username
      FROM username_auth_users u
      LEFT JOIN user_profiles p ON p.user_id = u.user_id
      WHERE p.user_id IS NULL AND LENGTH(TRIM(u.username)) >= 3
      LIMIT 50
    `.catch(() => []),
    sql`
      SELECT t.user_id,
             t.data->>'partnerUsername' AS username,
             t.data->>'shareToken'     AS share_token
      FROM training_logs t
      LEFT JOIN user_profiles p ON p.user_id = t.user_id
      WHERE t.date = 'config'
        AND LENGTH(TRIM(t.data->>'partnerUsername')) >= 3
        AND p.user_id IS NULL
      LIMIT 50
    `.catch(() => []),
  ])
  const rows = [...authUsers, ...configs]
  for (const r of rows) {
    await sql`
      INSERT INTO user_profiles (user_id, username, share_token, updated_at)
      VALUES (${r.user_id}, ${r.username}, ${r.share_token || null}, now())
      ON CONFLICT (user_id) DO UPDATE SET
        username   = EXCLUDED.username,
        share_token = EXCLUDED.share_token,
        updated_at = now()
    `.catch(() => {})
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Username-Auth, X-Username-Token')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' })

  const sql = neon(process.env.DATABASE_URL)
  const userId = await getAuthenticatedUserId(req, sql)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  await ensureTables(sql)

  if (String(req.query?.admin || '') === '1') {
    await ensureAdminTables(sql)
    await runBackfill(sql).catch(() => {})
    if (!(await isAdmin(req, userId))) {
      return res.status(403).json({
        error: 'Admin access only',
        currentUserId: userId,
        setup: 'Add this user ID to TRAINING_LOG_ADMIN_USER_IDS in Vercel, then redeploy.',
      })
    }
    return res.json(await listAdminUsers(sql, userId))
  }

  const q = String(req.query?.q || '').trim().toLowerCase()
  if (q.length < 1) return res.json({ results: [] })
  await runBackfill(sql).catch(() => {})

  const rows = await sql`
    WITH searchable_users AS (
      SELECT user_id, username FROM user_profiles
      UNION
      SELECT user_id, username FROM username_auth_users
    )
    SELECT DISTINCT ON (LOWER(su.username))
      su.user_id,
      su.username,
      f_out.status AS follow_status,
      f_in.status  AS follower_status
    FROM searchable_users su
    LEFT JOIN follows f_out
      ON f_out.requester_id = ${userId} AND f_out.target_id = su.user_id
    LEFT JOIN follows f_in
      ON f_in.requester_id = su.user_id  AND f_in.target_id  = ${userId}
    WHERE LOWER(su.username) LIKE ${q + '%'}
      AND su.user_id != ${userId}
    ORDER BY LOWER(su.username), su.username
    LIMIT 20
  `

  return res.json({
    results: rows.map(r => ({
      userId:         r.user_id,
      username:       r.username,
      followStatus:   r.follow_status   || 'none',
      followerStatus: r.follower_status || 'none',
    })),
  })
}
