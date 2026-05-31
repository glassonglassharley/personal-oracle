const express = require('express');
const crypto = require('crypto');
const pool = require('../db');

const router = express.Router();

function sanitizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

function newToken() {
  return `vt_${crypto.randomBytes(32).toString('base64url')}`;
}

function validToken(token) {
  return /^vt_[A-Za-z0-9_-]{40,}$/.test(String(token || ''));
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

router.post('/', async (req, res, next) => {
  try {
    const username = sanitizeUsername(req.body?.username);
    const providedToken = String(req.body?.token || '').trim();

    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Choose a username with at least 3 letters or numbers.' });
    }

    const existing = await pool.query(
      'SELECT id, auth_username, username_token_hash FROM users WHERE auth_username = $1 OR clerk_user_id = $2 LIMIT 1',
      [username, `username:${username}`]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      // No token provided — user is trying to create but username already exists
      if (!providedToken) {
        return res.status(409).json({ error: `"${username}" is already taken. If it's your account, enter your access token to sign in instead.` });
      }
      // Token provided but wrong
      if (!validToken(providedToken) || !row.username_token_hash || !safeEqual(hashToken(providedToken), row.username_token_hash)) {
        return res.status(401).json({ error: 'Wrong access token for that username. Check your token and try again. If you\'ve lost it, sign in on your original device and use "Use on another device" to get a new link.' });
      }
      return res.json({ username: row.auth_username || username, token: providedToken, created: false });
    }

    const token = newToken();
    const tokenHash = hashToken(token);
    const inserted = await pool.query(
      `INSERT INTO users (clerk_user_id, name, auth_username, username_token_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING auth_username`,
      [`username:${username}`, username, username, tokenHash]
    );

    res.status(201).json({ username: inserted.rows[0].auth_username, token, created: true });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That username was just claimed. Pick another username or enter its saved access token.' });
    }
    next(err);
  }
});

module.exports = { router, sanitizeUsername, hashToken, validToken, safeEqual };
