const { plaidClient } = require('./_plaid')
const { requireSameOrigin, validateToken } = require('./_validate')

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireSameOrigin(req, res)) return

  const { public_token } = req.body || {}
  const err0 = validateToken(public_token, 'public_token')
  if (err0) return res.status(400).json({ error: err0 })

  try {
    const response = await plaidClient.itemPublicTokenExchange({ public_token })
    const { access_token, item_id } = response.data
    res.json({ access_token, item_id })
  } catch (err) {
    console.error('exchange-token error:', err?.response?.data?.error_code ?? err.message)
    res.status(500).json({ error: 'Token exchange failed' })
  }
}
