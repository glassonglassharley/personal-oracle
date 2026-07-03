function requireSameOrigin(req, res) {
  const origin = req.headers.origin || ''
  const isLocal = /^https?:\/\/localhost(:\d+)?$/.test(origin)
  const isOurApp = /^https:\/\/debt-assassination[\w-]*\.vercel\.app$/.test(origin)
  if (origin && !isLocal && !isOurApp) {
    res.status(403).json({ error: 'Forbidden' })
    return false
  }
  return true
}

function validateToken(token, label) {
  if (typeof token !== 'string') return `${label} must be a string`
  if (token.length === 0) return `${label} is required`
  if (token.length > 300) return `${label} is invalid`
  return null
}

module.exports = { requireSameOrigin, validateToken }
