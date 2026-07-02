import followsHandler from '../lib/api-handlers/follows.js'
import partnerHandler from '../lib/api-handlers/partner.js'

export const config = { maxDuration: 15 }

function parseBody(req) {
  if (!req.body || typeof req.body !== 'string') return req.body || {}
  try { return JSON.parse(req.body) } catch { return {} }
}

function getSocialType(req) {
  const body = parseBody(req)
  return String(req.query?.type || body?.type || '').toLowerCase()
}

export default async function handler(req, res) {
  const type = getSocialType(req)

  if (type === 'follow' || type === 'follows') {
    return followsHandler(req, res)
  }
  if (type === 'partner') {
    return partnerHandler(req, res)
  }

  return res.status(400).json({
    error: 'Invalid social type',
    supported: ['follow', 'partner'],
  })
}
