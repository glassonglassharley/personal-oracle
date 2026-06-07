const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { getInternalUserId, awardXP } = require('../utils');

function hashVoiceToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ── /api/voice-log — custom bearer-token auth (not Clerk/JWT) ─────────────
const logRouter = express.Router();

logRouter.post('/', async (req, res, next) => {
  try {
    const authHeader = String(req.get('Authorization') || '');
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authorization required' });
    }
    const rawToken = authHeader.slice(7).trim();
    const tokenHash = hashVoiceToken(rawToken);

    const tokenRow = await pool.query(
      'SELECT id, user_id FROM voice_tokens WHERE token_hash = $1',
      [tokenHash]
    );
    if (tokenRow.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    const userId = tokenRow.rows[0].user_id;

    const { text } = req.body;
    const input = String(text || '');
    if (!input) return res.json({ success: false, message: 'Could not parse entry' });

    const amountMatch = input.match(/\$?(\d+\.?\d{0,2})/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : null;

    const qtyMatch = input.match(/(\d+)\s+(beer|cigarette|drink|smoke|coffee|wine|shot|can|bottle)/i);
    if (!qtyMatch) {
      return res.json({ success: false, message: 'Could not parse entry' });
    }
    const quantity = parseInt(qtyMatch[1], 10);
    const keyword = qtyMatch[2].toLowerCase();

    const vices = await pool.query('SELECT * FROM vices WHERE user_id = $1', [userId]);
    const matched = vices.rows.find(v => {
      const vname = v.name.toLowerCase();
      return vname.includes(keyword) || keyword.includes(vname);
    });
    if (!matched) {
      return res.json({ success: false, message: 'Could not parse entry' });
    }

    const pricePerUnit = (amount !== null && quantity > 0)
      ? amount / quantity
      : Number(matched.default_price ?? 0);

    const today = new Date().toISOString().split('T')[0];
    await pool.query(
      'INSERT INTO entries (vice_id, date, quantity, price_per_unit) VALUES ($1, $2, $3, $4)',
      [matched.id, today, quantity, pricePerUnit]
    );

    awardXP(userId, 5).catch(() => {});

    const plural = quantity !== 1 ? `${keyword}s` : keyword;
    const amountStr = amount !== null ? ` for $${amount.toFixed(2)}` : '';
    return res.json({ success: true, message: `Logged ${quantity} ${plural}${amountStr}` });
  } catch (err) { next(err); }
});

// ── /api/voice-tokens — standard JWT/Clerk auth ───────────────────────────
const tokenRouter = express.Router();

tokenRouter.get('/', async (req, res, next) => {
  try {
    const uid = await getInternalUserId(req.auth.userId);
    const r = await pool.query(
      'SELECT id, label, created_at FROM voice_tokens WHERE user_id = $1 ORDER BY created_at DESC',
      [uid]
    );
    res.json(r.rows);
  } catch (err) { next(err); }
});

tokenRouter.post('/', async (req, res, next) => {
  try {
    const uid = await getInternalUserId(req.auth.userId);
    const { label } = req.body;
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashVoiceToken(rawToken);
    const r = await pool.query(
      'INSERT INTO voice_tokens (user_id, token_hash, label) VALUES ($1, $2, $3) RETURNING id, label, created_at',
      [uid, tokenHash, label || null]
    );
    res.status(201).json({ ...r.rows[0], token: rawToken });
  } catch (err) { next(err); }
});

tokenRouter.delete('/:id', async (req, res, next) => {
  try {
    const uid = await getInternalUserId(req.auth.userId);
    const r = await pool.query(
      'DELETE FROM voice_tokens WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, uid]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Token not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = { logRouter, tokenRouter };
