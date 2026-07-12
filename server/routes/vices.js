const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getInternalUserId, verifyViceOwnership, resolveUnitLabel } = require('../utils');

router.get('/', async (req, res, next) => {
  try {
    const uid = await getInternalUserId(req.auth.userId);
    console.log('DEBUG vices auth', { rawUserId: req.auth.userId, resolvedUid: uid });
    const r = await pool.query('SELECT * FROM vices WHERE user_id = $1 ORDER BY id', [uid]);
    res.json(r.rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const uid = await getInternalUserId(req.auth.userId);
    const { name, unit_label, default_price, emoji, category, monthly_budget, plaid_categories } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    if (name.length > 100) return res.status(400).json({ error: 'Vice name must be 100 characters or fewer.' });
    const r = await pool.query(
      `INSERT INTO vices (user_id, name, unit_label, default_price, emoji, category, monthly_budget, plaid_categories)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [uid, name, resolveUnitLabel(name, unit_label), default_price ?? 0, emoji || '🔴', category || 'Other', monthly_budget ?? null, JSON.stringify(plaid_categories ?? [])]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!await verifyViceOwnership(req.params.id, req.auth.userId))
      return res.status(403).json({ error: 'Forbidden' });
    const { name, unit_label, default_price, emoji, category, monthly_budget, plaid_categories } = req.body;
    if (name && name.length > 100) return res.status(400).json({ error: 'Vice name must be 100 characters or fewer.' });
    const r = await pool.query(
      `UPDATE vices SET
        name           = COALESCE($1, name),
        unit_label     = COALESCE($2, unit_label),
        default_price  = COALESCE($3, default_price),
        emoji          = COALESCE($4, emoji),
        category       = COALESCE($5, category),
        monthly_budget = $6,
        plaid_categories = COALESCE($7, plaid_categories)
       WHERE id = $8 RETURNING *`,
      [name, unit_label, default_price, emoji, category, monthly_budget ?? null,
       plaid_categories !== undefined ? JSON.stringify(plaid_categories) : null,
       req.params.id]
    );
    res.json(r.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!await verifyViceOwnership(req.params.id, req.auth.userId))
      return res.status(403).json({ error: 'Forbidden' });
    const entryCount = await pool.query('SELECT COUNT(*) FROM entries WHERE vice_id = $1', [req.params.id]);
    await pool.query('DELETE FROM vices WHERE id = $1', [req.params.id]);
    res.json({ ok: true, deleted_entries: parseInt(entryCount.rows[0].count) });
  } catch (err) { next(err); }
});

module.exports = router;
