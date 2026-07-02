import crypto from 'crypto'
import { verifyToken } from '@clerk/backend'

export function normalizeUsername(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/[-_.]{2,}/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 32)
}

export function isValidUsername(username) {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)
}

export function hashUsernameToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex')
}

function safeEqualHex(a, b) {
  if (!a || !b || a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

export function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex')
    crypto.pbkdf2(String(password), salt, 100000, 64, 'sha512', (err, key) => {
      if (err) reject(err)
      else resolve(`${salt}:${key.toString('hex')}`)
    })
  })
}

export function verifyPassword(password, storedHash) {
  return new Promise((resolve, reject) => {
    const parts = String(storedHash || '').split(':')
    if (parts.length !== 2) return resolve(false)
    const [salt, hash] = parts
    crypto.pbkdf2(String(password), salt, 100000, 64, 'sha512', (err, key) => {
      if (err) reject(err)
      else {
        try {
          resolve(crypto.timingSafeEqual(Buffer.from(hash, 'hex'), key))
        } catch {
          resolve(false)
        }
      }
    })
  })
}

export async function ensureUsernameAuthTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS username_auth_users (
      username      text PRIMARY KEY,
      token_hash    text NOT NULL UNIQUE,
      user_id       text NOT NULL UNIQUE,
      created_at    timestamptz DEFAULT now(),
      last_seen_at  timestamptz DEFAULT now()
    )
  `
  await sql`ALTER TABLE username_auth_users ADD COLUMN IF NOT EXISTS password_hash text`
}

export async function getAuthenticatedUserId(req, sql) {
  const username = normalizeUsername(req.headers['x-username-auth'])
  const usernameToken = req.headers['x-username-token']

  if (username || usernameToken) {
    if (!sql || !isValidUsername(username) || !usernameToken) return null
    await ensureUsernameAuthTable(sql)
    const rows = await sql`
      SELECT token_hash, user_id
      FROM username_auth_users
      WHERE username = ${username}
      LIMIT 1
    `
    const row = rows[0]
    if (!row) return null
    const incomingHash = hashUsernameToken(usernameToken)
    if (!safeEqualHex(row.token_hash, incomingHash)) return null
    await sql`
      UPDATE username_auth_users
      SET last_seen_at = now()
      WHERE username = ${username}
    `
    return row.user_id
  }

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token || !process.env.CLERK_SECRET_KEY) return null
  try {
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })
    return payload.sub
  } catch {
    return null
  }
}
