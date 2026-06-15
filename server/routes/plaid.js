const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getInternalUserId } = require('../utils');

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

// Lazy-load the plaid module and cache the client so a missing bundle only
// affects /api/plaid/* routes, not the whole server startup.
let _plaidClient = null;
function getPlaidClient() {
  if (_plaidClient) return _plaidClient;
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    throw Object.assign(new Error('Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET in Vercel.'), { status: 503 });
  }
  const { PlaidApi, Configuration, PlaidEnvironments } = require('plaid');
  const plaidEnv = process.env.PLAID_ENV || 'sandbox';
  _plaidClient = new PlaidApi(new Configuration({
    basePath: PlaidEnvironments[plaidEnv],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
      },
    },
  }));
  return _plaidClient;
}

// POST /api/plaid/create-link-token
// Body (all optional): { institution_id } — pass Plaid institution ID to pre-select a bank
router.post('/create-link-token', async (req, res, next) => {
  try {
    const { Products, CountryCode } = require('plaid');
    const plaid = getPlaidClient();
    const { institution_id } = req.body || {};

    // Pass verified phone from Clerk so Plaid can use it for OTP / identity verification
    const plaidUser = { client_user_id: String(req.auth.userId) };
    try {
      const { clerkClient } = require('@clerk/express');
      const clerkUser = await clerkClient.users.getUser(req.auth.userId);
      const phones = clerkUser.phoneNumbers || [];
      const verified = phones.find(p => p.verification?.status === 'verified') || phones[0];
      if (verified?.phoneNumber) {
        plaidUser.phone_number = verified.phoneNumber; // E.164 format from Clerk
        if (verified.verification?.verifiedAtTime) {
          plaidUser.phone_number_verified_time = new Date(verified.verification.verifiedAtTime).toISOString();
        }
      }
    } catch (_) {}

    const linkParams = {
      user: plaidUser,
      client_name: 'Vice Spending',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    };
    // OAuth institutions require redirect_uri in link token creation, but Plaid
    // rejects unregistered redirect URIs with a 400. Only send the explicit
    // Plaid allowlisted URI, not the generic app URL.
    if (process.env.PLAID_REDIRECT_URI) {
      linkParams.redirect_uri = process.env.PLAID_REDIRECT_URI;
    }
    // Pre-select a specific institution (e.g. Navy Federal ins_133383) to bypass fuzzy search
    if (institution_id && /^ins_[0-9]+$/.test(institution_id)) {
      linkParams.institution_id = institution_id;
    }

    const response = await plaid.linkTokenCreate(linkParams);
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    const plaidError = err.response?.data;
    console.error('Plaid create-link-token error:', plaidError || err.message);
    if (plaidError) {
      return res.status(err.response?.status || 400).json({
        error: plaidError.error_message || plaidError.error_code || 'Could not create Plaid link token.',
        plaid_error_code: plaidError.error_code,
        plaid_error_type: plaidError.error_type,
      });
    }
    return res.status(err.status || 500).json({ error: err.message || 'Could not create Plaid link token.' });
  }
});

// POST /api/plaid/exchange-token
router.post('/exchange-token', async (req, res, next) => {
  try {
    const plaid = getPlaidClient();
    const { public_token, institution_name } = req.body;
    if (!public_token) return res.status(400).json({ error: 'public_token required' });

    // Look up user before calling Plaid so we fail early with a clear error
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) {
      console.error('[Plaid exchange-token] user not found:', {
        authUserId: req.auth.userId,
        type: typeof req.auth.userId,
        vtAuth: !!req.vtAuth,
      });
      return res.status(404).json({ error: 'Session error — please refresh and try again.' });
    }

    const exchangeRes = await plaid.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = exchangeRes.data;

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

// POST /api/plaid/sync  — returns last 90 days of vice-related transactions from all connected banks
router.post('/sync', async (req, res, next) => {
  try {
    const plaid = getPlaidClient();
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const connRows = await pool.query(
      'SELECT access_token, institution_name FROM plaid_connections WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    if (!connRows.rows.length) return res.status(404).json({ error: 'No bank connected' });

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 90);
    const fmt = d => d.toISOString().split('T')[0];

    const allViceTxs = [];
    for (const { access_token, institution_name } of connRows.rows) {
      try {
        const txRes = await plaid.transactionsGet({
          access_token,
          start_date: fmt(start),
          end_date: fmt(end),
          options: { count: 500, offset: 0, include_personal_finance_category: true },
        });
        txRes.data.transactions
          .filter(tx => tx.amount > 0 && isViceTransaction(tx))
          .forEach(tx => allViceTxs.push({
            date: tx.date,
            merchant: tx.merchant_name || tx.name,
            amount: tx.amount,
            category: tx.personal_finance_category?.detailed
              || (tx.category || []).join(' > '),
            transaction_id: tx.transaction_id,
            institution: institution_name || 'Bank',
          }));
      } catch (bankErr) {
        console.error(`Plaid sync error for ${institution_name}:`, bankErr.response?.data || bankErr.message);
      }
    }

    // Deduplicate by transaction_id (same tx can't appear across banks, but be safe)
    const seen = new Set();
    const viceTxs = allViceTxs.filter(tx => {
      if (seen.has(tx.transaction_id)) return false;
      seen.add(tx.transaction_id);
      return true;
    });

    viceTxs.sort((a, b) => b.date.localeCompare(a.date));

    res.json({ transactions: viceTxs });
  } catch (err) {
    console.error('Plaid sync error:', err.response?.data || err.message);
    next(err);
  }
});

// DELETE /api/plaid/imports — remove all imported bank entries for this user
router.delete('/imports', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const result = await pool.query(
      `DELETE FROM entries
       WHERE (import_source = 'plaid' OR note LIKE '%imported from bank%')
         AND vice_id IN (SELECT id FROM vices WHERE user_id = $1)
       RETURNING id`,
      [userId]
    );
    res.json({ deleted: result.rowCount });
  } catch (err) { next(err); }
});

// POST /api/plaid/move-entries — move all entries from one vice to another for this user
// Body: { from_vice_id, to_vice_id }
router.post('/move-entries', async (req, res, next) => {
  try {
    const { from_vice_id, to_vice_id } = req.body;
    if (!from_vice_id || !to_vice_id) return res.status(400).json({ error: 'from_vice_id and to_vice_id required' });

    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    // Verify the user owns both vices
    const ownsCheck = await pool.query(
      'SELECT id FROM vices WHERE id = ANY($1) AND user_id = $2',
      [[Number(from_vice_id), Number(to_vice_id)], userId]
    );
    if (ownsCheck.rowCount < 2) return res.status(403).json({ error: 'Forbidden' });

    const result = await pool.query(
      `UPDATE entries SET vice_id = $1 WHERE vice_id = $2 RETURNING id`,
      [Number(to_vice_id), Number(from_vice_id)]
    );
    res.json({ moved: result.rowCount });
  } catch (err) { next(err); }
});

// GET /api/plaid/accounts — real-time balances for all accounts across connected banks
router.get('/accounts', async (req, res, next) => {
  try {
    const plaid = getPlaidClient();
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const connRows = await pool.query(
      'SELECT access_token, institution_name FROM plaid_connections WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    if (!connRows.rows.length) return res.json({ accounts: [] });

    const allAccounts = [];
    for (const { access_token, institution_name } of connRows.rows) {
      try {
        const balRes = await plaid.accountsBalanceGet({ access_token });
        balRes.data.accounts.forEach(acct => {
          allAccounts.push({
            account_id: acct.account_id,
            name: acct.name,
            official_name: acct.official_name || null,
            type: acct.type,       // 'depository', 'credit', 'investment', etc.
            subtype: acct.subtype, // 'checking', 'savings', 'cd', etc.
            balance: acct.balances.current,
            institution: institution_name || 'Bank',
          });
        });
      } catch (bankErr) {
        console.error(`Plaid accounts error for ${institution_name}:`, bankErr.response?.data || bankErr.message);
      }
    }

    res.json({ accounts: allAccounts });
  } catch (err) { next(err); }
});

// GET /api/plaid/status — check whether the user has connected banks (may be multiple)
router.get('/status', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.json({ connected: false });

    const connRows = await pool.query(
      'SELECT institution_name FROM plaid_connections WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    if (!connRows.rows.length) return res.json({ connected: false });

    const banks = connRows.rows.map(r => r.institution_name || 'Bank');
    res.json({ connected: true, banks });
  } catch (err) { next(err); }
});

module.exports = router;
