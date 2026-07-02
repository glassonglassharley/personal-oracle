import { neon } from '@neondatabase/serverless'
import { getAuthenticatedUserId } from '../serverAuth.js'

export const config = { maxDuration: 10 }

async function ensureTables(sql) {
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
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Username-Auth, X-Username-Token')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' })

  const sql = neon(process.env.DATABASE_URL)
  const userId = await getAuthenticatedUserId(req, sql)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  await ensureTables(sql)

  // ── GET: following + pending_received ─────────────────────────────────────
  if (req.method === 'GET') {
    // "following" is bidirectional: you see someone if EITHER side is the accepted requester.
    // This ensures both User A (who sent) and User B (who accepted) see each other.
    const [outgoing, incoming, pendingReceived, pendingSent] = await Promise.all([
      sql`
        SELECT f.target_id AS partner_id, COALESCE(up.username, uau.username) AS username
        FROM follows f
        LEFT JOIN user_profiles up ON up.user_id = f.target_id
        LEFT JOIN username_auth_users uau ON uau.user_id = f.target_id
        WHERE f.requester_id = ${userId} AND f.status = 'accepted'
        ORDER BY f.updated_at DESC
      `,
      sql`
        SELECT f.requester_id AS partner_id, COALESCE(up.username, uau.username) AS username
        FROM follows f
        LEFT JOIN user_profiles up ON up.user_id = f.requester_id
        LEFT JOIN username_auth_users uau ON uau.user_id = f.requester_id
        WHERE f.target_id = ${userId} AND f.status = 'accepted'
        ORDER BY f.updated_at DESC
      `,
      sql`
        SELECT f.requester_id AS partner_id, COALESCE(up.username, uau.username) AS username
        FROM follows f
        LEFT JOIN user_profiles up ON up.user_id = f.requester_id
        LEFT JOIN username_auth_users uau ON uau.user_id = f.requester_id
        WHERE f.target_id = ${userId} AND f.status = 'pending'
        ORDER BY f.created_at DESC
      `,
      sql`
        SELECT f.target_id AS partner_id, COALESCE(up.username, uau.username) AS username
        FROM follows f
        LEFT JOIN user_profiles up ON up.user_id = f.target_id
        LEFT JOIN username_auth_users uau ON uau.user_id = f.target_id
        WHERE f.requester_id = ${userId} AND f.status = 'pending'
        ORDER BY f.created_at DESC
      `,
    ])

    // Merge both directions; deduplicate by userId (edge case: mutual explicit follows)
    const seen = new Set()
    const following = [...outgoing, ...incoming].filter(r => {
      if (seen.has(r.partner_id)) return false
      seen.add(r.partner_id)
      return true
    })

    return res.json({
      following:       following.map(r => ({ userId: r.partner_id, username: r.username || r.partner_id })),
      pendingReceived: pendingReceived.map(r => ({ userId: r.partner_id, username: r.username || r.partner_id })),
      pendingSent:     pendingSent.map(r => ({ userId: r.partner_id, username: r.username || r.partner_id })),
    })
  }

  // ── POST: send follow request. Share-token invites auto-accept; username search
  // creates a normal pending request that the other athlete must approve.
  if (req.method === 'POST') {
    let body = req.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid JSON' }) }
    }
    const { targetId, shareToken } = body || {}
    if (!targetId || targetId === userId) return res.status(400).json({ error: 'Invalid targetId' })

    let status = 'pending'
    if (shareToken) {
      // Confirm the token belongs to targetId — this is the proof of invitation.
      const tokenRows = await sql`
        SELECT 1 FROM training_logs
        WHERE user_id = ${targetId} AND date = 'config' AND data->>'shareToken' = ${shareToken}
        LIMIT 1
      `.catch(() => [])
      if (!tokenRows.length) return res.status(403).json({ error: 'Invalid invite token' })
      status = 'accepted'
    }

    await sql`
      INSERT INTO follows (requester_id, target_id, status, updated_at)
      VALUES (${userId}, ${targetId}, ${status}, now())
      ON CONFLICT (requester_id, target_id)
      DO UPDATE SET status = ${status}, updated_at = now()
    `
    return res.json({ ok: true, status })
  }

  // ── PUT: accept or decline incoming request ───────────────────────────────
  if (req.method === 'PUT') {
    let body = req.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid JSON' }) }
    }
    const { requesterId, action } = body || {}
    if (!requesterId || !['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Missing requesterId or invalid action' })
    }
    const status = action === 'accept' ? 'accepted' : 'declined'
    await sql`
      UPDATE follows
      SET status = ${status}, updated_at = now()
      WHERE requester_id = ${requesterId} AND target_id = ${userId}
    `
    return res.json({ ok: true, status })
  }

  // ── DELETE: unfollow or cancel outgoing request ───────────────────────────
  if (req.method === 'DELETE') {
    const targetId = req.query?.targetId
    if (!targetId) return res.status(400).json({ error: 'Missing targetId' })
    await sql`
      DELETE FROM follows
      WHERE (requester_id = ${userId} AND target_id = ${targetId})
         OR (requester_id = ${targetId} AND target_id = ${userId})
    `
    return res.json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
