const { plaidClient, plaidConfig } = require('./_plaid')
const { requireSameOrigin } = require('./_validate')

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireSameOrigin(req, res)) return

  if (!plaidConfig.hasClientId || !plaidConfig.hasSecret) {
    return res.status(500).json({ error: 'Debt Plaid credentials not configured' })
  }

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'debt-assassination-user' },
      client_name: 'Debt Assassination',
      products: ['transactions', 'liabilities'],
      country_codes: ['US'],
      language: 'en',
    })
    res.json({ link_token: response.data.link_token })
  } catch (err) {
    console.error('create-link-token error:', err?.response?.data?.error_code ?? err.message)
    res.status(500).json({ error: 'Failed to create link token' })
  }
}
