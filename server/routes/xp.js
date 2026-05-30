const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getInternalUserId, getLevelInfo } = require('../utils');

router.get('/', async (req, res, next) => {
  try {
    const uid = await getInternalUserId(req.auth.userId);
    if (!uid) return res.json({ total_xp: 0, ...getLevelInfo(0) });
    const r = await pool.query('SELECT total_xp FROM user_xp WHERE user_id = $1', [uid]);
    const totalXp = r.rows[0]?.total_xp ?? 0;
    res.json({ total_xp: totalXp, ...getLevelInfo(totalXp) });
  } catch (err) { next(err); }
});

module.exports = router;
