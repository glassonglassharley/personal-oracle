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

// Written-number → digit, whole-word case-insensitive
const WORD_NUMS = {
  one:'1', two:'2', three:'3', four:'4', five:'5',
  six:'6', seven:'7', eight:'8', nine:'9', ten:'10',
};

// Qty + vice keyword regex
const QTY_VICE_RE = /(\d+)\s+(beer|beers|food delivery|food deliveries|delivery|rx|prescription|chips|chip|women|woman|fast food|fastfood)/i;

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
    console.log('[voice-log] input length:', input.length);
    console.log('[voice-log] input char codes:', [...input].map(c => `${c}(${c.charCodeAt(0)})`).join(''));

    if (!input) {
      console.log('[voice-log] empty input, returning parse failure');
      return res.json({ success: false, message: 'Could not parse entry' });
    }

    // 1. Collapse exotic Unicode whitespace (U+00A0, U+2009, U+200B, U+FEFF, etc.) to ASCII space
    const normalised = input
      .replace(/[  ​‌‍﻿⁠	]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    console.log('[voice-log] normalised:', JSON.stringify(normalised));

    // 2. Convert written numbers to digits (whole-word, case-insensitive)
    const digitised = normalised.replace(
      /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/gi,
      w => WORD_NUMS[w.toLowerCase()]
    );
    if (digitised !== normalised) console.log('[voice-log] digitised:', JSON.stringify(digitised));

    // 3. Qty + vice keyword — run before amount so we can exclude the qty number by position
    console.log('[voice-log] testing QTY_VICE_RE against:', JSON.stringify(digitised));
    const qtyMatch = digitised.match(QTY_VICE_RE);
    console.log('[voice-log] qtyMatch:', qtyMatch ? { qty: qtyMatch[1], kw: qtyMatch[2] } : null);

    // 4. Amount: prefer explicit $ prefix; otherwise collect all numbers, exclude the qty
    //    digit by string position, and take the largest remaining value.
    //    This handles "1 beer for 4" → amount 4, and "7.12 on 2 beers" → amount 7.12.
    let amount = null;
    const dollarMatch = digitised.match(/\$(\d+\.?\d{0,2})/);
    console.log('[voice-log] dollarMatch:', dollarMatch ? dollarMatch[1] : null);
    if (dollarMatch) {
      amount = parseFloat(dollarMatch[1]);
    } else {
      const allNums = [...digitised.matchAll(/(\d+(?:\.\d{1,2})?)/g)];
      const qtyStart = qtyMatch ? qtyMatch.index : -1;
      const candidates = allNums
        .filter(m => m.index !== qtyStart)
        .map(m => parseFloat(m[1]));
      console.log('[voice-log] amount candidates (excl qty):', candidates);
      if (candidates.length > 0) amount = Math.max(...candidates);
    }

    console.log('[voice-log] parsed:', {
      digitised,
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
    const insertResult = await pool.query(
      'INSERT INTO entries (vice_id, date, quantity, price_per_unit) VALUES ($1, $2, $3, $4) RETURNING *',
      [matched.id, today, quantity, pricePerUnit]
    );
    console.log('[voice-log] inserted entry:', insertResult.rows[0]);

    awardXP(userId, 5).catch(() => {});

    const amountStr = amount !== null ? ` for $${amount.toFixed(2)}` : '';
    console.log('[voice-log] success:', { userId, quantity, keyword, normalized, amount, pricePerUnit, viceId: matched.id, viceName: matched.name });
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
