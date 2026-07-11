const { plaidClient } = require('./_plaid')
const { requireSameOrigin, validateToken } = require('./_validate')

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireSameOrigin(req, res)) return

  const { access_token } = req.body || {}
  const err0 = validateToken(access_token, 'access_token')
  if (err0) return res.status(400).json({ error: err0 })

  try {
    const response = await plaidClient.liabilitiesGet({ access_token })
    const credit = (response.data.liabilities?.credit ?? []).map(c => ({
      account_id: c.account_id,
      last_payment_amount: c.last_payment_amount,
      last_payment_date: c.last_payment_date,
      minimum_payment_amount: c.minimum_payment_amount,
      next_payment_due_date: c.next_payment_due_date,
      aprs: c.aprs,
    }))
    res.json({ liabilities: { credit } })
  } catch (err) {
    const code = err?.response?.data?.error_code
    if (code === 'ITEM_LOGIN_REQUIRED') return res.status(401).json({ error: 'ITEM_LOGIN_REQUIRED' })
    console.error('get-liabilities error:', code ?? err.message)
    res.json({ liabilities: { credit: [] } })
  }
}
