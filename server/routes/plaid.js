const express = require('express');
const router = express.Router();
const pool = require('../db');
const { PlaidApi, Configuration, PlaidEnvironments, Products, CountryCode } = require('plaid');

const plaidEnv = process.env.PLAID_ENV || 'sandbox';
const configuration = new Configuration({
  basePath: PlaidEnvironments[plaidEnv],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});
const plaid = new PlaidApi(configuration);

// Vice-related Plaid personal_finance_category primary/detailed values
const VICE_CATEGORIES = new Set([
  'FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR',
  'FOOD_AND_DRINK_BAR',
  'FOOD_AND_DRINK_FAST_FOOD',
  'FOOD_AND_DRINK_COFFEE',
  'FOOD_AND_DRINK_RESTAURANTS',       // broad catch; filtered by name below too
  'GAMBLING',
  'ENTERTAINMENT_CASINOS_AND_GAMBLING',
  'GENERAL_MERCHANDISE_TOBACCO_AND_VAPING',
  'PERSONAL_CARE_TOBACCO_AND_SMOKING',
]);

// Fallback: match against Plaid's legacy category array strings
const VICE_KEYWORDS = ['alcohol', 'bar', 'bars', 'beer', 'wine', 'liquor', 'tobacco',
  'smoke', 'vape', 'fast food', 'casino', 'gambling', 'coffee shop', 'coffee'];

function isViceTransaction(tx) {
  const pfc = tx.personal_finance_category?.detailed
    || tx.personal_finance_category?.primary;
  if (pfc && VICE_CATEGORIES.has(pfc)) return true;

  const cats = (tx.category || []).map(c => c.toLowerCase());
  if (cats.some(c => VICE_KEYWORDS.some(k => c.includes(k)))) return true;

  const name = (tx.merchant_name || tx.name || '').toLowerCase();
  return VICE_KEYWORDS.some(k => name.includes(k));
}

// POST /api/plaid/create-link-token
router.post('/create-link-token', async (req, res, next) => {
  try {
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: String(req.auth.userId) },
      client_name: 'Vice Spending',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error('Plaid create-link-token error:', err.response?.data || err.message);
    next(err);
  }
});

// POST /api/plaid/exchange-token
router.post('/exchange-token', async (req, res, next) => {
  try {
    const { public_token, institution_name } = req.body;
    if (!public_token) return res.status(400).json({ error: 'public_token required' });

    const exchangeRes = await plaid.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = exchangeRes.data;

    const userRow = await pool.query(
      'SELECT id FROM users WHERE clerk_user_id = $1', [req.auth.userId]
    );
    const userId = userRow.rows[0]?.id;
    if (!userId) return res.status(404).json({ error: 'User not found' });

    await pool.query(
      `INSERT INTO plaid_connections (user_id, access_token, item_id, institution_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, item_id) DO UPDATE
         SET access_token = EXCLUDED.access_token,
             institution_name = EXCLUDED.institution_name`,
      [userId, access_token, item_id, institution_name || null]
    );

    res.json({ ok: true, institution_name });
  } catch (err) {
    console.error('Plaid exchange-token error:', err.response?.data || err.message);
    next(err);
  }
});

// POST /api/plaid/sync  — returns last 90 days of vice-related transactions
router.post('/sync', async (req, res, next) => {
  try {
    const userRow = await pool.query(
      'SELECT id FROM users WHERE clerk_user_id = $1', [req.auth.userId]
    );
    const userId = userRow.rows[0]?.id;
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const connRow = await pool.query(
      'SELECT access_token, institution_name FROM plaid_connections WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    if (!connRow.rows.length) return res.status(404).json({ error: 'No bank connected' });

    const { access_token, institution_name } = connRow.rows[0];

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 90);
    const fmt = d => d.toISOString().split('T')[0];

    const txRes = await plaid.transactionsGet({
      access_token,
      start_date: fmt(start),
      end_date: fmt(end),
      options: { count: 500, offset: 0, include_personal_finance_category: true },
    });

    const viceTxs = txRes.data.transactions
      .filter(tx => tx.amount > 0 && isViceTransaction(tx))
      .map(tx => ({
        date: tx.date,
        merchant: tx.merchant_name || tx.name,
        amount: tx.amount,
        category: tx.personal_finance_category?.detailed
          || (tx.category || []).join(' > '),
        transaction_id: tx.transaction_id,
      }));

    res.json({ transactions: viceTxs, institution_name });
  } catch (err) {
    console.error('Plaid sync error:', err.response?.data || err.message);
    next(err);
  }
});

// GET /api/plaid/status — check whether the user has a connected bank
router.get('/status', async (req, res, next) => {
  try {
    const userRow = await pool.query(
      'SELECT id FROM users WHERE clerk_user_id = $1', [req.auth.userId]
    );
    const userId = userRow.rows[0]?.id;
    if (!userId) return res.json({ connected: false });

    const connRow = await pool.query(
      'SELECT institution_name, created_at FROM plaid_connections WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    if (!connRow.rows.length) return res.json({ connected: false });

    res.json({ connected: true, institution_name: connRow.rows[0].institution_name });
  } catch (err) { next(err); }
});

module.exports = router;
