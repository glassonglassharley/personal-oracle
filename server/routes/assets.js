const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getInternalUserId } = require('../utils');

router.get('/', async (req, res, next) => {
  try {
    const uid = await getInternalUserId(req.auth.userId);
    if (!uid) return res.json([]);
    const r = await pool.query(
      'SELECT * FROM user_assets WHERE user_id = $1 ORDER BY created_at ASC',
      [uid]
    );
    res.json(r.rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const uid = await getInternalUserId(req.auth.userId);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { name, emoji, category, annual_return_pct, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' });
    const rate = parseFloat(annual_return_pct);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1000)
      return res.status(400).json({ error: 'Annual return must be between 0 and 1000%.' });

    const r = await pool.query(
      `INSERT INTO user_assets (user_id, name, emoji, category, annual_return_pct, description)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        uid,
        name.trim().slice(0, 80),
        (emoji || '📦').trim().slice(0, 8),
        (category || 'investment').trim().slice(0, 40),
        rate,
        (description || '').trim().slice(0, 200) || null,
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const uid = await getInternalUserId(req.auth.userId);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    await pool.query(
      'DELETE FROM user_assets WHERE id = $1 AND user_id = $2',
      [req.params.id, uid]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
