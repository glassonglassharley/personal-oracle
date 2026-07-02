import crypto from 'crypto'
import { neon } from '@neondatabase/serverless'
import {
  ensureUsernameAuthTable,
  hashUsernameToken,
  isValidUsername,
  normalizeUsername,
  hashPassword,
  verifyPassword,
} from '../../lib/serverAuth.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' })

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid JSON' }) }
  }

  const username = normalizeUsername(body?.username)
  const existingToken = body?.token
  const password = body?.password ? String(body.password) : null
  const createOnly = body?.createOnly === true

  if (!isValidUsername(username)) {
    return res.status(400).json({ error: 'Choose a username with 3-32 letters, numbers, dots, dashes, or underscores.' })
  }

  const sql = neon(process.env.DATABASE_URL)
  await ensureUsernameAuthTable(sql)
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

  const existing = await sql`
    SELECT token_hash, user_id, password_hash
    FROM username_auth_users
    WHERE username = ${username}
    LIMIT 1
  `

  // ── Existing user ─────────────────────────────────────────────────────────
  if (existing[0]) {
    const row = existing[0]

    if (createOnly) {
      // Signup attempt on an existing account — tell client to switch to login
      return res.status(409).json({ error: 'already_exists', message: 'That username already has an account.' })
    }

    // Login path: prefer password auth if a password is stored
    if (row.password_hash) {
      if (!password) {
        return res.status(401).json({ error: 'password_required', message: 'Enter your password to continue.' })
      }
      const ok = await verifyPassword(password, row.password_hash)
      if (!ok) {
        return res.status(401).json({ error: 'wrong_password', message: 'Incorrect password. Try again.' })
      }
    } else {
      // Legacy account (no password yet): only the device already holding the
      // original token may claim it and set the first password. Without a
      // matching token there is no proof of ownership, so this must be
      // rejected rather than waved through — otherwise anyone who knows the
      // username could set a password and lock out the real owner.
      const tokenOk = existingToken && hashUsernameToken(existingToken) === row.token_hash
      if (!tokenOk) {
        return res.status(401).json({ error: 'password_required', message: 'This account needs a password. Sign in from the device you originally used to set one.' })
      }
    }

    const token = crypto.randomBytes(32).toString('base64url')
    const tokenHash = hashUsernameToken(token)

    // If a password was provided and account had none, save it now
    if (password && !row.password_hash) {
      const ph = await hashPassword(password)
      await sql`
        UPDATE username_auth_users
        SET token_hash = ${tokenHash}, last_seen_at = now(), password_hash = ${ph}
        WHERE username = ${username}
      `
    } else {
      await sql`UPDATE username_auth_users SET token_hash = ${tokenHash}, last_seen_at = now() WHERE username = ${username}`
    }

    await sql`
      INSERT INTO user_profiles (user_id, username, updated_at)
      VALUES (${row.user_id}, ${username}, now())
      ON CONFLICT (user_id)
      DO UPDATE SET username = EXCLUDED.username, updated_at = now()
    `.catch(() => {})

    return res.json({ ok: true, username, token, userId: row.user_id, hasPassword: !!(password || row.password_hash) })
  }

  // ── New user (signup) ────────────────────────────────────────────────────
  if (!createOnly) {
    return res.status(404).json({ error: 'not_found', message: 'No account found for that username.' })
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'password_too_short', message: 'Password must be at least 6 characters.' })
  }

  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = hashUsernameToken(token)
  const userId = `username:${username}`
  const ph = await hashPassword(password)

  const profileConflict = await sql`
    SELECT user_id
    FROM user_profiles
    WHERE LOWER(username) = LOWER(${username}) AND user_id != ${userId}
    LIMIT 1
  `
  if (profileConflict[0]) {
    return res.status(409).json({ error: 'already_exists', message: 'That username already has an account.' })
  }

  await sql`
    INSERT INTO username_auth_users (username, token_hash, user_id, password_hash)
    VALUES (${username}, ${tokenHash}, ${userId}, ${ph})
  `
  await sql`
    INSERT INTO user_profiles (user_id, username, updated_at)
    VALUES (${userId}, ${username}, now())
    ON CONFLICT (user_id)
    DO UPDATE SET username = EXCLUDED.username, updated_at = now()
  `.catch(() => {})

  return res.json({ ok: true, username, token, userId, hasPassword: true })
}
