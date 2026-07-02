import { put, list, del } from '@vercel/blob'
import { neon } from '@neondatabase/serverless'
import { getAuthenticatedUserId } from '../lib/serverAuth.js'

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Username-Auth, X-Username-Token')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN not configured' })
  if (!process.env.DATABASE_URL)          return res.status(500).json({ error: 'DATABASE_URL not configured' })

  const sql    = neon(process.env.DATABASE_URL)
  const userId = await getAuthenticatedUserId(req, sql)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const action = req.query.action

  // ── GET ?action=list ──────────────────────────────────────────────────────
  if (req.method === 'GET' && action === 'list') {
    const { blobs } = await list({ prefix: `photos/${userId}/`, token: process.env.BLOB_READ_WRITE_TOKEN })
    const photos = blobs.map(b => {
      // pathname: photos/{userId}/{date}_{timestamp}.jpg
      const filename = b.pathname.split('/').pop()
      const date     = filename.split('_')[0] || new Date().toISOString().slice(0, 10)
      return { url: b.url, date }
    })
    return res.json(photos)
  }

  // ── POST ?action=upload&date=YYYY-MM-DD ───────────────────────────────────
  // Body: { dataUrl: 'data:image/jpeg;base64,...', date: 'YYYY-MM-DD' }
  if (req.method === 'POST' && action === 'upload') {
    let body = req.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid JSON' }) }
    }
    const { dataUrl, date = new Date().toISOString().slice(0, 10) } = body || {}
    if (!dataUrl) return res.status(400).json({ error: 'Missing dataUrl' })

    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
    const pathname = `photos/${userId}/${date}_${Date.now()}.jpg`

    const blob = await put(pathname, buffer, {
      access: 'public',
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: 'image/jpeg',
    })

    return res.json({ url: blob.url, date })
  }

  // ── DELETE ?action=delete&url=... ─────────────────────────────────────────
  if (req.method === 'DELETE' && action === 'delete') {
    const url = req.query.url
    if (!url) return res.status(400).json({ error: 'Missing url' })
    // Ownership check: URL path must contain the user's prefix
    if (!decodeURIComponent(url).includes(`/photos/${userId}/`)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN })
    return res.json({ ok: true })
  }

  return res.status(404).json({ error: `Unknown action: ${action}` })
}
