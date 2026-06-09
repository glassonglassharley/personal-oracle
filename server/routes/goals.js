const express = require('express');
const router = express.Router();
const pool = require('../db');
const { awardXP, getInternalUserId } = require('../utils');

router.get('/', async (req, res, next) => {
  try {
    const myId = await getInternalUserId(req.auth.userId);
    if (!myId) return res.json([]);
    const r = await pool.query(
      'SELECT * FROM goals WHERE user_id = $1 ORDER BY completed_at NULLS FIRST, created_at DESC',
      [myId]
    );
    res.json(r.rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const myId = await getInternalUserId(req.auth.userId);
    const { title, target_amount } = req.body;
    if (!title || !target_amount) return res.status(400).json({ error: 'title and target_amount required' });
    const r = await pool.query(
      'INSERT INTO goals (user_id, title, target_amount) VALUES ($1, $2, $3) RETURNING *',
      [myId, title.trim(), Number(target_amount)]
    );
    res.json(r.rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id/complete', async (req, res, next) => {
  try {
    const myId = await getInternalUserId(req.auth.userId);
    await pool.query(
      'UPDATE goals SET completed_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, myId]
    );
    res.json({ ok: true });
    awardXP(myId, 200).catch(() => {});
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const myId = await getInternalUserId(req.auth.userId);
    await pool.query('DELETE FROM goals WHERE id = $1 AND user_id = $2', [req.params.id, myId]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
