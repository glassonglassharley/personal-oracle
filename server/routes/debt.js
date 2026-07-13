const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getInternalUserId } = require('../utils');

// POST /api/debt/entries — upsert one debt for the authenticated user. Balance
// is a mutable current value (paying it down updates the same row), not a
// per-date event, so re-syncing the same debt_id overwrites, not duplicates.
router.post('/entries', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { debtId, lender, originalBalance, balance, limit, apr, minPayment,
      autopayEnabled, autopayAmount, autopayDueDay, source } = req.body || {};

    const debtIdNum = Number.isFinite(Number(debtId)) ? Math.floor(Number(debtId)) : NaN;
    if (!Number.isFinite(debtIdNum)) return res.status(400).json({ error: 'Invalid debtId' });
    const lenderClean = String(lender || '').trim().slice(0, 120);
    if (!lenderClean) return res.status(400).json({ error: 'Invalid lender' });
    const sourceClean = typeof source === 'string' && source.trim()
      ? source.trim().toLowerCase().slice(0, 40)
      : 'debt-assassination';

    const result = await pool.query(
      `INSERT INTO debts (
         user_id, debt_id, lender, original_balance, balance, limit_amount,
         apr, min_payment, autopay_enabled, autopay_amount, autopay_due_day,
         source, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
       ON CONFLICT (user_id, debt_id)
       DO UPDATE SET
         lender = EXCLUDED.lender,
         original_balance = EXCLUDED.original_balance,
         balance = EXCLUDED.balance,
         limit_amount = EXCLUDED.limit_amount,
         apr = EXCLUDED.apr,
         min_payment = EXCLUDED.min_payment,
         autopay_enabled = EXCLUDED.autopay_enabled,
         autopay_amount = EXCLUDED.autopay_amount,
         autopay_due_day = EXCLUDED.autopay_due_day,
         source = EXCLUDED.source,
         updated_at = now()
       RETURNING debt_id, lender, original_balance, balance, limit_amount, apr,
         min_payment, autopay_enabled, autopay_amount, autopay_due_day, source, updated_at`,
      [
        userId, debtIdNum, lenderClean,
        Math.max(0, Number(originalBalance) || 0),
        Math.max(0, Number(balance) || 0),
        Math.max(0, Number(limit) || 0),
        Number.isFinite(Number(apr)) ? Number(apr) : null,
        Number.isFinite(Number(minPayment)) ? Number(minPayment) : null,
        !!autopayEnabled,
        Number.isFinite(Number(autopayAmount)) ? Number(autopayAmount) : null,
        Number.isFinite(Number(autopayDueDay)) ? Math.floor(Number(autopayDueDay)) : null,
        sourceClean,
      ]
    );
    res.json({ ok: true, debt: result.rows[0] });
  } catch (err) { next(err); }
});

// GET /api/debt/entries — read back all of this user's debts.
router.get('/entries', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.json({ debts: [] });

    const result = await pool.query(
      `SELECT debt_id, lender, original_balance, balance, limit_amount, apr,
         min_payment, autopay_enabled, autopay_amount, autopay_due_day, source, updated_at
       FROM debts
       WHERE user_id = $1
       ORDER BY debt_id`,
      [userId]
    );
    res.json({ debts: result.rows });
  } catch (err) { next(err); }
});

// POST /api/debt/profile — upsert this user's creditScore/playerHealth/
// harleyDefiSplit. One row per user, same upsert semantics as /entries.
router.post('/profile', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { creditScore, playerHealth, harleyDefiSplit } = req.body || {};
    const splitClean = harleyDefiSplit && typeof harleyDefiSplit === 'object' && !Array.isArray(harleyDefiSplit)
      ? harleyDefiSplit
      : {};

    const result = await pool.query(
      `INSERT INTO debt_profile (user_id, credit_score, player_health, harley_defi_split, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_id)
       DO UPDATE SET
         credit_score = EXCLUDED.credit_score,
         player_health = EXCLUDED.player_health,
         harley_defi_split = EXCLUDED.harley_defi_split,
         updated_at = now()
       RETURNING credit_score, player_health, harley_defi_split, updated_at`,
      [
        userId,
        Number.isFinite(Number(creditScore)) ? Math.round(Number(creditScore)) : null,
        Number.isFinite(Number(playerHealth)) ? Math.round(Number(playerHealth)) : null,
        JSON.stringify(splitClean),
      ]
    );
    res.json({ ok: true, profile: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/debt/payments — append one payment record. Payments are
// immutable historical facts once logged, so this never upserts.
router.post('/payments', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { debtId, amount, paidAt, source } = req.body || {};
    const debtIdNum = Number.isFinite(Number(debtId)) ? Math.floor(Number(debtId)) : NaN;
    if (!Number.isFinite(debtIdNum)) return res.status(400).json({ error: 'Invalid debtId' });
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) return res.status(400).json({ error: 'Invalid amount' });
    const paidAtDate = new Date(paidAt);
    if (Number.isNaN(paidAtDate.getTime())) return res.status(400).json({ error: 'Invalid paidAt' });
    const sourceClean = typeof source === 'string' && source.trim()
      ? source.trim().toLowerCase().slice(0, 40)
      : 'debt-assassination';

    const result = await pool.query(
      `INSERT INTO debt_payments (user_id, debt_id, amount, paid_at, source)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, debt_id, amount, paid_at, source, created_at`,
      [userId, debtIdNum, amountNum, paidAtDate.toISOString(), sourceClean]
    );
    res.json({ ok: true, payment: result.rows[0] });
  } catch (err) { next(err); }
});

// GET /api/debt/payments — read back this user's payment history, most recent first.
router.get('/payments', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.json({ payments: [] });

    const result = await pool.query(
      `SELECT id, debt_id, amount, paid_at, source, created_at
       FROM debt_payments
       WHERE user_id = $1
       ORDER BY paid_at DESC, id DESC`,
      [userId]
    );
    res.json({ payments: result.rows });
  } catch (err) { next(err); }
});

// POST /api/debt/score — append one credit score reading. Same append-only
// rationale as /payments: a score reading is a historical fact, never upserted.
router.post('/score', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { score, recordedAt, source } = req.body || {};
    const scoreNum = Number.isFinite(Number(score)) ? Math.round(Number(score)) : NaN;
    if (!Number.isFinite(scoreNum)) return res.status(400).json({ error: 'Invalid score' });
    const recordedAtDate = new Date(recordedAt);
    if (Number.isNaN(recordedAtDate.getTime())) return res.status(400).json({ error: 'Invalid recordedAt' });
    const sourceClean = typeof source === 'string' && source.trim()
      ? source.trim().toLowerCase().slice(0, 40)
      : 'debt-assassination';

    const result = await pool.query(
      `INSERT INTO score_history (user_id, score, recorded_at, source)
       VALUES ($1, $2, $3, $4)
       RETURNING id, score, recorded_at, source, created_at`,
      [userId, scoreNum, recordedAtDate.toISOString(), sourceClean]
    );
    res.json({ ok: true, entry: result.rows[0] });
  } catch (err) { next(err); }
});

// GET /api/debt/score — read back this user's score history, most recent first.
router.get('/score', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.json({ history: [] });

    const result = await pool.query(
      `SELECT id, score, recorded_at, source, created_at
       FROM score_history
       WHERE user_id = $1
       ORDER BY recorded_at DESC, id DESC`,
      [userId]
    );
    res.json({ history: result.rows });
  } catch (err) { next(err); }
});

module.exports = router;
