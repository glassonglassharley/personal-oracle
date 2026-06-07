const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { getInternalUserId, awardXP } = require('../utils');

function hashVoiceToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Maps captured keyword variants to their canonical form for DB fuzzy matching
const KEYWORD_ALIASES = {
  'beers':            'beer',
  'food deliveries':  'food delivery',
  'delivery':         'food delivery',
  'prescription':     'rx',
  'chip':             'chips',
  'woman':            'women',
  'fastfood':         'fast food',
};

// ── /api/voice-log — custom bearer-token auth (not Clerk/JWT) ─────────────
const logRouter = express.Router();

// Accept both application/json and text/plain (Siri Shortcuts may send either)
logRouter.use(express.text({ type: 'text/plain' }));

logRouter.post('/', async (req, res, next) => {
  try {
    console.log('[voice-log] request received');
    console.log('[voice-log] content-type:', req.get('content-type'));
    console.log('[voice-log] body type:', typeof req.body);
    console.log('[voice-log] body raw:', JSON.stringify(req.body));

    const authHeader = String(req.get('Authorization') || '');
    console.log('[voice-log] auth header present:', authHeader.startsWith('Bearer '));
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authorization required' });
    }
    const rawToken = authHeader.slice(7).trim();
    const tokenHash = hashVoiceToken(rawToken);

    const tokenRow = await pool.query(
      'SELECT id, user_id FROM voice_tokens WHERE token_hash = $1',
      [tokenHash]
    );
    console.log('[voice-log] token lookup rows:', tokenRow.rows.length);
    if (tokenRow.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    const userId = tokenRow.rows[0].user_id;
    console.log('[voice-log] authenticated userId:', userId);

    // Handle both JSON body ({text: "..."}) and plain-text body ("I spent...")
    let input;
    if (typeof req.body === 'string') {
      input = req.body.trim();
    } else {
      const { text } = (req.body || {});
      input = String(text || '');
    }
    console.log('[voice-log] input text:', JSON.stringify(input));

    if (!input) {
      console.log('[voice-log] empty input, returning parse failure');
      return res.json({ success: false, message: 'Could not parse entry' });
    }

    // Qty + vice keyword — works regardless of word order
    const qtyMatch = input.match(/(\d+)\s+(beer|beers|food delivery|food deliveries|delivery|rx|prescription|chips|chip|women|woman|fast food|fastfood)/i);
    console.log('[voice-log] qtyMatch:', qtyMatch ? { qty: qtyMatch[1], kw: qtyMatch[2] } : null);

    // Amount: prefer explicit $ prefix, then any decimal number, then fallback any integer
    // This handles reversed order ("2 beers for 7.12") without capturing the quantity as the amount
    let amount = null;
    const dollarMatch = input.match(/\$(\d+\.?\d{0,2})/);
    console.log('[voice-log] dollarMatch:', dollarMatch ? dollarMatch[1] : null);
    if (dollarMatch) {
      amount = parseFloat(dollarMatch[1]);
    } else {
      const decimalMatch = input.match(/\b(\d+\.\d{1,2})\b/);
      console.log('[voice-log] decimalMatch:', decimalMatch ? decimalMatch[1] : null);
      if (decimalMatch) {
        amount = parseFloat(decimalMatch[1]);
      } else if (!qtyMatch) {
        const anyNum = input.match(/\b(\d+)\b/);
        if (anyNum) amount = parseFloat(anyNum[1]);
      }
    }

    console.log('[voice-log] parsed:', {
      input,
      quantity: qtyMatch ? parseInt(qtyMatch[1], 10) : null,
      keyword: qtyMatch?.[2]?.toLowerCase(),
      amount,
    });

    if (!qtyMatch) {
      console.log('[voice-log] no qty+vice match, returning parse failure');
      return res.json({ success: false, message: 'Could not parse entry' });
    }
    const quantity = parseInt(qtyMatch[1], 10);
    const keyword = qtyMatch[2].toLowerCase();
    const normalized = KEYWORD_ALIASES[keyword] || keyword;
    console.log('[voice-log] keyword:', keyword, '→ normalized:', normalized);

    const vices = await pool.query('SELECT * FROM vices WHERE user_id = $1', [userId]);
    console.log('[voice-log] user vices:', vices.rows.map(v => v.name));
    const matched = vices.rows.find(v => {
      const vname = v.name.toLowerCase();
      return vname.includes(normalized) || normalized.includes(vname);
    });
    if (!matched) {
      console.log('[voice-log] no vice match for keyword:', keyword);
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

    const amountStr = amount !== null ? ` for $${amount.toFixed(2)}` : '';
    console.log('[voice-log] success:', { quantity, keyword, normalized, amount, pricePerUnit, viceId: matched.id });
    return res.json({ success: true, message: `Logged ${quantity} ${keyword}${amountStr}` });
  } catch (err) {
    console.log('[voice-log] caught error:', err.message, err.stack);
    next(err);
  }
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
