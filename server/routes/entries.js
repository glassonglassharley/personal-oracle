const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyViceOwnership, verifyEntryOwnership } = require('../utils');

router.get('/', async (req, res, next) => {
  try {
    const { vice_id, from, to } = req.query;
    if (!vice_id) return res.status(400).json({ error: 'vice_id required' });
    if (!await verifyViceOwnership(vice_id, req.auth.userId))
      return res.status(403).json({ error: 'Forbidden' });

    let q = 'SELECT * FROM entries WHERE vice_id = $1';
    const params = [vice_id];
    if (from) { q += ` AND date >= $${params.length + 1}`; params.push(from); }
    if (to)   { q += ` AND date <= $${params.length + 1}`; params.push(to); }
    q += ' ORDER BY date DESC, created_at DESC, id DESC';

    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { vice_id, date, quantity, price_per_unit } = req.body;
    if (!vice_id || !date) return res.status(400).json({ error: 'vice_id and date required' });
    if (!await verifyViceOwnership(vice_id, req.auth.userId))
      return res.status(403).json({ error: 'Forbidden' });

    const r = await pool.query(
      `INSERT INTO entries (vice_id, date, quantity, price_per_unit)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [vice_id, date, quantity ?? 0, price_per_unit]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { vice_id, date, quantity, price_per_unit } = req.body;
    if (!vice_id || !date) return res.status(400).json({ error: 'vice_id and date required' });
    if (!await verifyEntryOwnership(req.params.id, req.auth.userId))
      return res.status(403).json({ error: 'Forbidden' });
    if (!await verifyViceOwnership(vice_id, req.auth.userId))
      return res.status(403).json({ error: 'Forbidden' });

    const r = await pool.query(
      `UPDATE entries
       SET vice_id = $1, date = $2, quantity = $3, price_per_unit = $4
       WHERE id = $5
       RETURNING *`,
      [vice_id, date, quantity ?? 0, price_per_unit, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json(r.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!await verifyEntryOwnership(req.params.id, req.auth.userId))
      return res.status(403).json({ error: 'Forbidden' });
    await pool.query('DELETE FROM entries WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
