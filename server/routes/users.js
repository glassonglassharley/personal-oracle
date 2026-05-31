const express = require('express');
const router = express.Router();
const pool = require('../db');

function userWhere(req) {
  // VT JWT auth: userId is numeric DB id
  if (req.vtAuth) return { col: 'id', val: req.auth.userId };
  return { col: 'clerk_user_id', val: req.auth.userId };
}

router.get('/me', async (req, res, next) => {
  try {
    const { col, val } = userWhere(req);
    const r = await pool.query(`SELECT * FROM users WHERE ${col} = $1`, [val]);
    res.json(r.rows[0]);
  } catch (err) { next(err); }
});

router.put('/me', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const { col, val } = userWhere(req);
    const r = await pool.query(
      `UPDATE users SET name = $1 WHERE ${col} = $2 RETURNING *`,
      [name, val]
    );
    res.json(r.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/me', async (req, res, next) => {
  try {
    const { col, val } = userWhere(req);
    await pool.query(`DELETE FROM users WHERE ${col} = $1`, [val]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
