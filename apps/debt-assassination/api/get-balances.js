const { plaidClient } = require('./_plaid')
const { requireSameOrigin, validateToken } = require('./_validate')

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireSameOrigin(req, res)) return

  const { access_token } = req.body || {}
  const err0 = validateToken(access_token, 'access_token')
  if (err0) return res.status(400).json({ error: err0 })

  try {
    const response = await plaidClient.accountsBalanceGet({ access_token })
    const accounts = response.data.accounts.map(a => ({
      account_id: a.account_id,
      name: a.name,
      official_name: a.official_name,
      type: a.type,
      subtype: a.subtype,
      balances: {
        current: a.balances.current,
        available: a.balances.available,
        limit: a.balances.limit,
      },
    }))
    res.json({ accounts })
  } catch (err) {
    const code = err?.response?.data?.error_code
    if (code === 'ITEM_LOGIN_REQUIRED') return res.status(401).json({ error: 'ITEM_LOGIN_REQUIRED' })
    console.error('get-balances error:', code ?? err.message)
    res.status(500).json({ error: 'Failed to fetch balances' })
  }
}
