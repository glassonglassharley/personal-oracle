const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyViceOwnership, getInternalUserId } = require('../utils');

const COMBINED_ACCOUNT_FIELDS = `
  account_key,
  source,
  institution_id,
  institution_name,
  account_name,
  account_type,
  account_subtype,
  mask,
  current_balance,
  available_balance,
  currency,
  included_in_combined_savings,
  disconnected,
  last_synced_at
`;

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

function normalizeCurrency(code) {
  return typeof code === 'string' && code.trim() ? code.trim().toUpperCase().slice(0, 10) : 'USD';
}

function toNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function rowToCombinedAccount(row) {
  return {
    id: row.account_key,
    institutionId: row.institution_id,
    institutionName: row.institution_name,
    accountName: row.account_name,
    accountType: row.account_type,
    accountSubtype: row.account_subtype,
    mask: row.mask,
    currentBalance: toNumberOrNull(row.current_balance),
    availableBalance: toNumberOrNull(row.available_balance),
    currency: row.currency || 'USD',
    source: row.source,
    includedInCombinedSavings: !!row.included_in_combined_savings,
    disconnected: !!row.disconnected,
    lastSyncedAt: row.last_synced_at,
  };
}

function combinedBalanceFromRows(rows) {
  return rows.reduce((sum, row) => {
    if (!row.included_in_combined_savings || row.disconnected) return sum;
    const balance = toNumberOrNull(row.current_balance);
    return balance === null ? sum : sum + balance;
  }, 0);
}

async function refreshPlaidCombinedAccounts(userId) {
  const connRows = await pool.query(
    `SELECT access_token, item_id, institution_id, institution_name
     FROM plaid_connections
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  const hasPlaidConnections = connRows.rows.length > 0;
  if (!hasPlaidConnections) return { hasPlaidConnections: false, syncErrors: [] };

  const plaid = getPlaidClient();
  const seenKeys = [];
  const syncErrors = [];

  await pool.query(
    `UPDATE combined_savings_accounts
     SET disconnected = TRUE, updated_at = NOW()
     WHERE user_id = $1 AND source = 'plaid'`,
    [userId]
  );

  for (const conn of connRows.rows) {
    try {
      const balRes = await plaid.accountsBalanceGet({ access_token: conn.access_token });
      for (const acct of balRes.data.accounts || []) {
        const accountKey = acct.account_id;
        if (!accountKey) continue;
        seenKeys.push(accountKey);
        const current = acct.balances?.current ?? acct.balances?.available ?? null;
        const available = acct.balances?.available ?? null;
        await pool.query(
          `INSERT INTO combined_savings_accounts (
             user_id, account_key, source, institution_id, institution_name,
             account_name, account_type, account_subtype, mask,
             current_balance, available_balance, currency,
             disconnected, last_synced_at, updated_at
           ) VALUES ($1,$2,'plaid',$3,$4,$5,$6,$7,$8,$9,$10,$11,FALSE,NOW(),NOW())
           ON CONFLICT (user_id, account_key) DO UPDATE SET
             source = 'plaid',
             institution_id = EXCLUDED.institution_id,
             institution_name = EXCLUDED.institution_name,
             account_name = EXCLUDED.account_name,
             account_type = EXCLUDED.account_type,
             account_subtype = EXCLUDED.account_subtype,
             mask = EXCLUDED.mask,
             current_balance = EXCLUDED.current_balance,
             available_balance = EXCLUDED.available_balance,
             currency = EXCLUDED.currency,
             disconnected = FALSE,
             last_synced_at = NOW(),
             updated_at = NOW()`,
          [
            userId,
            accountKey,
            conn.institution_id || conn.item_id || null,
            conn.institution_name || 'Bank',
            acct.name || acct.official_name || 'Account',
            acct.type || null,
            acct.subtype || null,
            acct.mask || null,
            current,
            available,
            normalizeCurrency(acct.balances?.iso_currency_code),
          ]
        );
      }
    } catch (err) {
      syncErrors.push({ institution: conn.institution_name || 'Bank', error: err.response?.data?.error_message || err.message });
      console.error(`[combined savings] Plaid balance refresh failed for ${conn.institution_name || 'Bank'}:`, err.response?.data?.error_code || err.message);
    }
  }

  return { hasPlaidConnections, seenKeys, syncErrors };
}

async function loadCombinedSavings(userId, { refreshPlaid = true } = {}) {
  const refresh = refreshPlaid
    ? await refreshPlaidCombinedAccounts(userId)
    : { hasPlaidConnections: false, syncErrors: [] };

  const rows = await pool.query(
    `SELECT ${COMBINED_ACCOUNT_FIELDS}
     FROM combined_savings_accounts
     WHERE user_id = $1
     ORDER BY source = 'manual', institution_name, account_name, account_key`,
    [userId]
  );
  const combinedBalance = combinedBalanceFromRows(rows.rows);
  if (rows.rows.length > 0) {
    await pool.query(
      'UPDATE users SET savings_balance = $1, savings_updated_at = NOW() WHERE id = $2',
      [combinedBalance, userId]
    );
  }

  return {
    accounts: rows.rows.map(rowToCombinedAccount),
    combinedBalance,
    updated_at: new Date().toISOString(),
    hasPlaidConnections: !!refresh.hasPlaidConnections,
    syncErrors: refresh.syncErrors || [],
  };
}

// GET /api/savings/balance — return actual savings balance
router.get('/balance', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.json({ balance: 0, updated_at: null });
    const r = await pool.query('SELECT savings_balance, savings_updated_at FROM users WHERE id = $1', [userId]);
    const row = r.rows[0];
    res.json({ balance: Number(row?.savings_balance || 0), updated_at: row?.savings_updated_at || null });
  } catch (err) { next(err); }
});

// PUT /api/savings/balance — manually update actual savings balance. Also
// used by the bank-sync flow (Savings.jsx prefills the input from a Plaid
// account balance, then this same endpoint commits it) — source distinguishes
// the two so history isn't ambiguous about where a snapshot came from.
router.put('/balance', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.status(404).json({ error: 'User not found' });
    const balance = Number(req.body?.balance);
    if (!Number.isFinite(balance) || balance < 0) return res.status(400).json({ error: 'Invalid balance' });
    const source = req.body?.source === 'plaid' ? 'plaid' : 'manual';
    await pool.query(
      'UPDATE users SET savings_balance = $1, savings_updated_at = NOW() WHERE id = $2',
      [balance, userId]
    );
    await pool.query(
      'INSERT INTO savings_balance_history (user_id, balance, source) VALUES ($1, $2, $3)',
      [userId, balance, source]
    );
    res.json({ balance, updated_at: new Date().toISOString() });
  } catch (err) { next(err); }
});

// GET /api/savings/history — snapshot history for the line chart, newest first.
// No backfill and no simulated points: only rows written by an actual save
// (manual or bank-sync) ever appear here.
router.get('/history', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.json({ history: [] });
    const r = await pool.query(
      `SELECT balance, recorded_at, source
       FROM savings_balance_history
       WHERE user_id = $1
       ORDER BY recorded_at DESC`,
      [userId]
    );
    res.json({ history: r.rows });
  } catch (err) { next(err); }
});

// GET /api/savings/combined-accounts — synced Plaid + manual accounts that can
// be included in the Combined Savings balance. Access tokens stay server-side;
// account rows are refreshed from Plaid and selection state is preserved by
// stable provider account_id.
router.get('/combined-accounts', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.status(404).json({ error: 'User not found' });
    res.json(await loadCombinedSavings(userId, { refreshPlaid: req.query.refresh !== '0' }));
  } catch (err) { next(err); }
});

// PUT /api/savings/combined-accounts — persist inclusion/exclusion for one
// account and recompute the Combined Savings total.
router.put('/combined-accounts', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.status(404).json({ error: 'User not found' });
    const accountKey = typeof req.body?.account_key === 'string' ? req.body.account_key.trim() : '';
    if (!accountKey || accountKey.length > 255) return res.status(400).json({ error: 'Valid account_key required' });
    await pool.query(
      `UPDATE combined_savings_accounts
       SET included_in_combined_savings = $1, updated_at = NOW()
       WHERE user_id = $2 AND account_key = $3`,
      [!!req.body?.included, userId, accountKey]
    );
    res.json(await loadCombinedSavings(userId, { refreshPlaid: false }));
  } catch (err) { next(err); }
});

// POST /api/savings/combined-accounts/manual — manual fallback account for
// institutions/accounts not returned by Plaid.
router.post('/combined-accounts/manual', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.status(404).json({ error: 'User not found' });
    const institutionName = String(req.body?.institutionName || req.body?.institution || '').trim().slice(0, 120);
    const accountName = String(req.body?.accountName || req.body?.name || '').trim().slice(0, 120);
    const accountType = String(req.body?.accountType || req.body?.type || 'manual').trim().slice(0, 80);
    const balance = Number(req.body?.currentBalance ?? req.body?.balance);
    if (!institutionName) return res.status(400).json({ error: 'Institution required' });
    if (!accountName) return res.status(400).json({ error: 'Account name required' });
    if (!Number.isFinite(balance)) return res.status(400).json({ error: 'Valid current balance required' });

    const accountKey = `manual:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
    await pool.query(
      `INSERT INTO combined_savings_accounts (
         user_id, account_key, source, institution_name, account_name,
         account_type, current_balance, currency, included_in_combined_savings,
         disconnected, last_synced_at, updated_at
       ) VALUES ($1,$2,'manual',$3,$4,$5,$6,'USD',TRUE,FALSE,NOW(),NOW())`,
      [userId, accountKey, institutionName, accountName, accountType, balance]
    );
    res.status(201).json(await loadCombinedSavings(userId, { refreshPlaid: false }));
  } catch (err) { next(err); }
});

// DELETE /api/savings/combined-accounts/manual — remove a manual fallback
// account. Synced Plaid accounts are disconnected through /api/plaid/connections.
router.delete('/combined-accounts/manual', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.status(404).json({ error: 'User not found' });
    const accountKey = typeof req.body?.account_key === 'string' ? req.body.account_key.trim() : '';
    if (!accountKey) return res.status(400).json({ error: 'account_key required' });
    await pool.query(
      `DELETE FROM combined_savings_accounts
       WHERE user_id = $1 AND account_key = $2 AND source = 'manual'`,
      [userId, accountKey]
    );
    res.json(await loadCombinedSavings(userId, { refreshPlaid: false }));
  } catch (err) { next(err); }
});

router.get('/:vice_id', async (req, res, next) => {
  try {
    const { vice_id } = req.params;
    if (!await verifyViceOwnership(vice_id, req.auth.userId))
      return res.status(403).json({ error: 'Forbidden' });

    const days = parseInt(req.query.days) || 365;

    const r = await pool.query(
      `SELECT COALESCE(SUM(quantity * price_per_unit),0)::float AS total_spend,
              COUNT(*)::int AS day_count
       FROM entries WHERE vice_id = $1`,
      [vice_id]
    );
    const { total_spend, day_count } = r.rows[0];
    const perDay = day_count > 0 ? total_spend / day_count : 0;

    res.json({
      days,
      projected_saving: r2(perDay * days),
      per_day:   r2(perDay),
      per_week:  r2(perDay * 7),
      per_month: r2(perDay * 30.44),
      milestones: {
        30:   r2(perDay * 30),
        90:   r2(perDay * 90),
        365:  r2(perDay * 365),
        1825: r2(perDay * 1825),
      }
    });
  } catch (err) { next(err); }
});

function r2(n) { return Math.round(n * 100) / 100; }

module.exports = router;
