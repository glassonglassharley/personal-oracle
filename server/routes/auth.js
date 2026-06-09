const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { sanitizeUsername, hashToken, validToken, safeEqual } = require('./usernameAuth');
const { sendMagicLinkEmail } = require('../email');

const router = express.Router();

const BCRYPT_ROUNDS = 12;
const SESSION_EXPIRY = '90d';
const MAGIC_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

// Rate limiters
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many login attempts. Try again in 15 minutes.' } });
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many accounts created from this IP. Try again later.' } });
const demoLimiter  = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many demo accounts from this IP. Try again later.' } });
const magicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many magic link requests. Try again in 15 minutes.' } });

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw Object.assign(new Error('JWT_SECRET not configured'), { status: 500 });
  if (s.length < 32) throw Object.assign(new Error('JWT_SECRET must be at least 32 characters'), { status: 500 });
  return s;
}

function signSession(userId, username) {
  return jwt.sign({ sub: userId, username }, getSecret(), { expiresIn: SESSION_EXPIRY });
}

function verifySession(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
}

function hashMagicToken(raw) {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// POST /api/auth/signup
router.post('/signup', signupLimiter, async (req, res, next) => {
  try {
    const username = sanitizeUsername(req.body?.username);
    const password = String(req.body?.password || '').trim();
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    const email = rawEmail || null;

    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters.' });
    }
    if (username.length > 30) {
      return res.status(400).json({ error: 'Username must be 30 characters or fewer.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (email && !validateEmail(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }

    const taken = await pool.query(
      'SELECT auth_username FROM users WHERE auth_username = $1 LIMIT 1',
      [username]
    );
    if (taken.rows.length > 0) {
      return res.status(409).json({ error: `"${username}" is already taken.` });
    }

    if (email) {
      const emailTaken = await pool.query(
        'SELECT id FROM users WHERE email = $1 LIMIT 1', [email]
      );
      if (emailTaken.rows.length > 0) {
        return res.status(409).json({ error: 'That email is already associated with an account.' });
      }
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (clerk_user_id, name, auth_username, password_hash, email)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, auth_username`,
      [`username:${username}`, username, username, passwordHash, email]
    );

    const user = result.rows[0];
    res.status(201).json({ jwt: signSession(user.id, user.auth_username), username: user.auth_username });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That username or email is already taken.' });
    }
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const username = sanitizeUsername(req.body?.username);
    const password = String(req.body?.password || '').trim();

    if (!username) return res.status(400).json({ error: 'Username required.' });

    const result = await pool.query(
      `SELECT id, auth_username, password_hash, username_token_hash
       FROM users WHERE auth_username = $1 OR clerk_user_id = $2 LIMIT 1`,
      [username, `username:${username}`]
    );

    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'No account found with that username.' });

    // Existing token-based account, no password yet — needs migration
    if (!user.password_hash && user.username_token_hash) {
      return res.status(401).json({ error: 'migration_required' });
    }

    if (!user.password_hash) {
      return res.status(401).json({ error: 'No account found with that username.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Wrong password.' });

    res.json({ jwt: signSession(user.id, user.auth_username), username: user.auth_username });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/demo — create ephemeral demo account (no password, no email)
router.post('/demo', demoLimiter, async (req, res, next) => {
  try {
    const username = sanitizeUsername(req.body?.username);
    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Username too short.' });
    }

    const existing = await pool.query(
      'SELECT id FROM users WHERE auth_username = $1 LIMIT 1', [username]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username taken.' });
    }

    const result = await pool.query(
      `INSERT INTO users (clerk_user_id, name, auth_username) VALUES ($1, $2, $3) RETURNING id, auth_username`,
      [`username:${username}`, username, username]
    );

    const user = result.rows[0];
    res.status(201).json({
      jwt: signSession(user.id, user.auth_username),
      username: user.auth_username,
      created: true,
    });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username taken.' });
    next(err);
  }
});

// POST /api/auth/migrate — exchange old vt_ token for password (migration flow)
router.post('/migrate', async (req, res, next) => {
  try {
    const username = sanitizeUsername(req.body?.username);
    const oldToken = String(req.body?.oldToken || '').trim();
    const newPassword = String(req.body?.newPassword || '').trim();
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    const email = rawEmail || null;

    if (!username || !oldToken) {
      return res.status(400).json({ error: 'Username and access token required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (email && !validateEmail(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }

    const result = await pool.query(
      `SELECT id, auth_username, username_token_hash
       FROM users WHERE auth_username = $1 OR clerk_user_id = $2 LIMIT 1`,
      [username, `username:${username}`]
    );

    const user = result.rows[0];
    if (!user || !user.username_token_hash) {
      return res.status(401).json({ error: 'No account found.' });
    }
    if (!validToken(oldToken) || !safeEqual(hashToken(oldToken), user.username_token_hash)) {
      return res.status(401).json({ error: 'Wrong access token.' });
    }

    if (email) {
      const emailTaken = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2 LIMIT 1', [email, user.id]
      );
      if (emailTaken.rows.length > 0) {
        return res.status(409).json({ error: 'That email is already in use.' });
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.query(
      `UPDATE users SET password_hash = $1, email = COALESCE($2, email), username_token_hash = NULL WHERE id = $3`,
      [passwordHash, email, user.id]
    );

    res.json({ jwt: signSession(user.id, user.auth_username), username: user.auth_username });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/token-exchange — silently migrate existing localStorage sessions to JWT
router.post('/token-exchange', async (req, res, next) => {
  try {
    const username = sanitizeUsername(req.body?.username);
    const token = String(req.body?.token || '').trim();

    if (!username || !token) {
      return res.status(400).json({ error: 'Username and token required.' });
    }

    const result = await pool.query(
      `SELECT id, auth_username, username_token_hash
       FROM users WHERE (auth_username = $1 OR clerk_user_id = $2) LIMIT 1`,
      [username, `username:${username}`]
    );

    const user = result.rows[0];
    if (!user || !user.username_token_hash) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    if (!validToken(token) || !safeEqual(hashToken(token), user.username_token_hash)) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    // needsPasswordSetup: true if they haven't migrated to password auth yet
    res.json({
      jwt: signSession(user.id, user.auth_username),
      username: user.auth_username,
      needsPasswordSetup: true,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/magic — request magic link (login or password reset)
router.post('/magic', magicLimiter, async (req, res, next) => {
  try {
    const purpose = ['login', 'reset'].includes(req.body?.purpose) ? req.body.purpose : 'login';
    const identifier = String(req.body?.identifier || '').trim().toLowerCase();

    if (!identifier) {
      return res.status(400).json({ error: 'Enter your email or username.' });
    }

    const result = await pool.query(
      `SELECT id, auth_username, email FROM users
       WHERE email = $1 OR auth_username = $2 LIMIT 1`,
      [identifier, sanitizeUsername(identifier)]
    );

    const user = result.rows[0];

    // Always return the same response regardless of account/email existence to prevent enumeration
    if (!user || !user.email) {
      return res.json({ ok: true, message: 'If an account with that identifier exists, a magic link has been sent.' });
    }

    const raw = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashMagicToken(raw);
    const expiresAt = new Date(Date.now() + MAGIC_EXPIRY_MS);

    await pool.query(
      `INSERT INTO magic_links (user_id, token_hash, purpose, expires_at) VALUES ($1, $2, $3, $4)`,
      [user.id, tokenHash, purpose, expiresAt]
    );

    const baseUrl = process.env.APP_URL || 'http://localhost:5173';
    await sendMagicLinkEmail({
      to: user.email,
      username: user.auth_username,
      magicUrl: `${baseUrl}/?magic=${raw}`,
      purpose,
    });

    res.json({ ok: true, message: 'Check your email for the link — it expires in 15 minutes.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/magic/verify?t=<token>
router.get('/magic/verify', async (req, res, next) => {
  try {
    const raw = String(req.query.t || '').trim();
    if (!raw) return res.status(400).json({ error: 'Token required.' });

    const tokenHash = hashMagicToken(raw);
    const result = await pool.query(
      `SELECT ml.id, ml.user_id, ml.purpose, ml.expires_at, ml.used_at, u.auth_username
       FROM magic_links ml JOIN users u ON u.id = ml.user_id
       WHERE ml.token_hash = $1 LIMIT 1`,
      [tokenHash]
    );

    const link = result.rows[0];
    if (!link) return res.status(401).json({ error: 'Invalid or expired magic link.' });
    if (link.used_at) return res.status(401).json({ error: 'This link has already been used.' });
    if (new Date() > new Date(link.expires_at)) {
      return res.status(401).json({ error: 'This link has expired. Request a new one.' });
    }

    await pool.query('UPDATE magic_links SET used_at = NOW() WHERE id = $1', [link.id]);

    if (link.purpose === 'reset') {
      const resetToken = jwt.sign(
        { sub: link.user_id, username: link.auth_username, purpose: 'reset' },
        getSecret(),
        { expiresIn: '15m' }
      );
      return res.json({ purpose: 'reset', resetToken, username: link.auth_username });
    }

    res.json({
      jwt: signSession(link.user_id, link.auth_username),
      username: link.auth_username,
      purpose: 'login',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/magic/reset — set new password via magic link reset token
router.post('/magic/reset', async (req, res, next) => {
  try {
    const resetToken = String(req.body?.resetToken || '').trim();
    const newPassword = String(req.body?.newPassword || '').trim();

    if (!resetToken || newPassword.length < 8) {
      return res.status(400).json({ error: 'Reset token and new password (8+ chars) required.' });
    }

    const payload = verifySession(resetToken);
    if (!payload || payload.purpose !== 'reset') {
      return res.status(401).json({ error: 'Invalid or expired reset token.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, auth_username',
      [passwordHash, payload.sub]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'User not found.' });

    const user = result.rows[0];
    res.json({ jwt: signSession(user.id, user.auth_username), username: user.auth_username });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/admin/reset-user — forcibly set a password without requiring the old token.
// Requires X-Admin-Secret header matching ADMIN_SECRET env var.
router.post('/admin/reset-user', async (req, res, next) => {
  try {
    const provided = String(req.get('X-Admin-Secret') || '').trim();
    const expected = process.env.ADMIN_SECRET;
    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected || '');
    const valid = expected && provided &&
      providedBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(providedBuf, expectedBuf);
    if (!valid) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const username = sanitizeUsername(req.body?.username);
    const newPassword = String(req.body?.newPassword || '').trim();

    if (!username) return res.status(400).json({ error: 'Username required.' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const result = await pool.query(
      `SELECT id, auth_username, email FROM users
       WHERE auth_username = $1 OR clerk_user_id = $2 LIMIT 1`,
      [username, `username:${username}`]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: `No user found: ${username}` });

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.query(
      'UPDATE users SET password_hash = $1, username_token_hash = NULL WHERE id = $2',
      [passwordHash, user.id]
    );

    res.json({ ok: true, username: user.auth_username, email: user.email || null, message: 'Password reset.' });
  } catch (err) {
    next(err);
  }
});

module.exports = { router, signSession, verifySession };
