const express = require('express');
const router = express.Router();
const pool = require('../db');
const { backupEntries, BACKUP_DIR } = require('../backup');

function authAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return res.status(503).json({ error: 'ADMIN_SECRET not configured' });
  const auth = req.get('authorization') || '';
  const header = req.get('x-admin-secret') || '';
  if (auth === `Bearer ${secret}` || header === secret) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

router.get('/backup', authAdmin, async (req, res, next) => {
  try {
    const result = await backupEntries(pool);
    res.json({ ok: true, file: result.file, rows: result.rows, backupDir: BACKUP_DIR });
  } catch (err) { next(err); }
});

// GET /api/admin/users — list all users with their auth type and basic stats
router.get('/users', authAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        u.id,
        u.username,
        u.email,
        u.name,
        u.created_at,
        CASE
          WHEN u.clerk_user_id IS NOT NULL THEN 'clerk'
          WHEN u.password_hash IS NOT NULL THEN 'password'
          ELSE 'magic-link'
        END AS auth_type,
        COUNT(DISTINCT v.id)  AS vice_count,
        COUNT(DISTINCT e.id)  AS entry_count,
        MAX(e.date)           AS last_entry_date
      FROM users u
      LEFT JOIN vices v ON v.user_id = u.id
      LEFT JOIN entries e ON e.vice_id = v.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json({ count: rows.length, users: rows });
  } catch (err) { next(err); }
});

module.exports = router;
