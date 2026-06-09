const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyViceOwnership, verifyEntryOwnership, getInternalUserId, awardXP } = require('../utils');

// GET /api/entries/all — all entries across all vices for the current user
router.get('/all', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.json({ entries: [], total: 0 });

    const { vice_id, from, to, search } = req.query;
    const lim = Math.min(Number(req.query.limit) || 50, 200);
    const off = Number(req.query.offset) || 0;

    const params = [userId];
    let where = 'WHERE v.user_id = $1 AND e.quantity > 0';

    if (vice_id) {
      params.push(Number(vice_id));
      where += ` AND v.id = $${params.length}`;
    }
    if (from) {
      params.push(from);
      where += ` AND e.date >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      where += ` AND e.date <= $${params.length}`;
    }
    if (search) {
      params.push(`%${search.trim()}%`);
      where += ` AND (e.note ILIKE $${params.length} OR v.name ILIKE $${params.length})`;
    }

    const countQ = `SELECT COUNT(*)::int AS total FROM entries e JOIN vices v ON v.id = e.vice_id ${where}`;
    const [countR] = await Promise.all([pool.query(countQ, params)]);

    params.push(lim, off);
    const rows = await pool.query(`
      SELECT e.id, e.date::text, e.quantity::float, e.price_per_unit::float, e.note, e.created_at,
             v.id AS vice_id, v.name AS vice_name, v.emoji AS vice_emoji
      FROM entries e JOIN vices v ON v.id = e.vice_id
      ${where}
      ORDER BY e.date DESC, e.created_at DESC, e.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({ entries: rows.rows, total: countR.rows[0].total });
  } catch (err) { next(err); }
});

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
    const { vice_id, date, quantity, price_per_unit, note } = req.body;
    const viceId = Number(vice_id);
    const entryQuantity = Number(quantity ?? 0);
    const entryPrice = Number(price_per_unit ?? 0);

    if (!viceId || !date) return res.status(400).json({ error: 'vice_id and date required' });
    if (!Number.isFinite(entryQuantity) || entryQuantity < 0)
      return res.status(400).json({ error: 'quantity must be a non-negative number' });
    if (!Number.isFinite(entryPrice) || entryPrice < 0)
      return res.status(400).json({ error: 'price_per_unit must be a non-negative number' });
    if (!await verifyViceOwnership(viceId, req.auth.userId))
      return res.status(403).json({ error: 'Forbidden' });

    // Manual saves are always new entry rows. Do not add an upsert clause here:
    // the entries table intentionally has no unique (vice_id, date) constraint
    // so users can log multiple same-day entries without overwriting history.
    const r = await pool.query(
      `INSERT INTO entries (vice_id, date, quantity, price_per_unit, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [viceId, date, entryQuantity, entryPrice, note || null]
    );
    res.status(201).json(r.rows[0]);
    // Fire-and-forget XP award: +20 for clean day, +5 for any log
    getInternalUserId(req.auth.userId)
      .then(uid => uid && awardXP(uid, entryQuantity === 0 ? 20 : 5))
      .catch(() => {});
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
