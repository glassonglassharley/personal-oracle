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

module.exports = router;
