const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyViceOwnership, getInternalUserId } = require('../utils');

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

// PUT /api/savings/balance — manually update actual savings balance
router.put('/balance', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.status(404).json({ error: 'User not found' });
    const balance = Number(req.body?.balance);
    if (!Number.isFinite(balance) || balance < 0) return res.status(400).json({ error: 'Invalid balance' });
    await pool.query(
      'UPDATE users SET savings_balance = $1, savings_updated_at = NOW() WHERE id = $2',
      [balance, userId]
    );
    res.json({ balance, updated_at: new Date().toISOString() });
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
