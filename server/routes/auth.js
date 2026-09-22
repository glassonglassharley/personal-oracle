const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { sanitizeUsername, hashToken, validToken, safeEqual } = require('./usernameAuth');
const { sendMagicLinkEmail, sendOneTimeCodeEmail } = require('../email');

const router = express.Router();

const BCRYPT_ROUNDS = 12;
const SESSION_EXPIRY = '90d';
const MAGIC_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const EMAIL_CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

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

function isoDateDaysAgo(daysAgo) {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function isoTimestampDaysAgo(daysAgo) {
  const d = new Date(`${isoDateDaysAgo(daysAgo)}T12:00:00.000Z`);
  return d.toISOString();
}

async function seedRichDemoAccount(client, userId) {
  const demoVices = [
    { name: 'Smoking',       emoji: '🚬', unit: 'cigarette', defaultPrice: 0.72, category: 'Nicotine', monthlyBudget: 95, baseQty: 8,   endQty: 1.2 },
    { name: 'Vaping',        emoji: '💨', unit: 'session',   defaultPrice: 1.35, category: 'Nicotine', monthlyBudget: 60, baseQty: 4,   endQty: 0.8 },
    { name: 'Alcohol',       emoji: '🍺', unit: 'drink',     defaultPrice: 7.50, category: 'Alcohol',  monthlyBudget: 120, baseQty: 2.4, endQty: 0.5 },
    { name: 'Weed',          emoji: '🌿', unit: 'session',   defaultPrice: 8.00, category: 'Cannabis', monthlyBudget: 85, baseQty: 1.4, endQty: 0.3 },
    { name: 'Gambling',      emoji: '🎰', unit: 'session',   defaultPrice: 35.00, category: 'Money',   monthlyBudget: 75, baseQty: 0.55,endQty: 0.08 },
    { name: 'Fast Food',     emoji: '🍔', unit: 'meal',      defaultPrice: 14.00, category: 'Food',    monthlyBudget: 130, baseQty: 1.2, endQty: 0.35 },
    { name: 'Energy Drinks', emoji: '⚡', unit: 'can',       defaultPrice: 3.75, category: 'Caffeine', monthlyBudget: 50, baseQty: 2.1, endQty: 0.45 },
  ];

  const viceRows = [];
  for (const vice of demoVices) {
    const inserted = await client.query(
      `INSERT INTO vices (user_id, name, unit_label, default_price, emoji, category, monthly_budget, plaid_categories)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'[]') RETURNING id`,
      [userId, vice.name, vice.unit, vice.defaultPrice, vice.emoji, vice.category, vice.monthlyBudget]
    );
    viceRows.push({ ...vice, id: inserted.rows[0].id });
  }

  const startBalance = 460;
  let savingsBalance = startBalance;
  const savingsHistory = [];
  const entryValues = [];
  const entryParams = [];
  let p = 1;
  const totalDays = 183;

  for (let daysAgo = totalDays - 1; daysAgo >= 0; daysAgo--) {
    const elapsed = totalDays - 1 - daysAgo;
    const progress = elapsed / (totalDays - 1);
    const date = isoDateDaysAgo(daysAgo);
    const weeklyCleanReset = elapsed % 17 === 4 || elapsed % 29 === 11;
    const recentCleanStreak = daysAgo <= 7;
    const isAllCleanDay = recentCleanStreak || weeklyCleanReset;
    let dailySpend = 0;

    for (const vice of viceRows) {
      const targetQty = vice.baseQty * (1 - progress) + vice.endQty * progress;
      const rhythm = Math.sin((elapsed + vice.id) * 1.7) * 0.18 + Math.cos((elapsed + vice.id) * 0.41) * 0.14;
      const skippedVice = !isAllCleanDay && progress > 0.45 && ((elapsed + vice.id) % 9 === 0);
      let quantity = isAllCleanDay || skippedVice ? 0 : Math.max(0, targetQty * (1 + rhythm));
      if (quantity > 0) {
        if (vice.unit === 'cigarette' || vice.unit === 'can') quantity = Math.round(quantity);
        else quantity = Math.round(quantity * 10) / 10;
        quantity = Math.max(quantity, vice.unit === 'cigarette' || vice.unit === 'can' ? 1 : 0.1);
      }
      dailySpend += quantity * vice.defaultPrice;
      entryValues.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
      entryParams.push(vice.id, date, quantity, vice.defaultPrice, quantity === 0 ? 'Demo clean-day log' : 'Demo six-month habit log');
    }

    const plannedInvestment = isAllCleanDay ? 42 : Math.max(8, 46 - dailySpend * 0.45);
    const marketDrift = 3.5 + Math.sin(elapsed / 11) * 6;
    savingsBalance += plannedInvestment + marketDrift;
    if (elapsed % 10 === 0 || daysAgo === 0) {
      savingsHistory.push({ balance: Math.round(savingsBalance * 100) / 100, recordedAt: isoTimestampDaysAgo(daysAgo) });
    }
  }

  if (entryValues.length) {
    await client.query(
      `INSERT INTO entries (vice_id, date, quantity, price_per_unit, note) VALUES ${entryValues.join(',')}`,
      entryParams
    );
  }

  const finalBalance = savingsHistory[savingsHistory.length - 1]?.balance || Math.round(savingsBalance * 100) / 100;
  await client.query(
    `UPDATE users
     SET savings_balance = $1,
         savings_updated_at = NOW(),
         companion_type = 'tree',
         companion_state = $2
     WHERE id = $3`,
    [
      finalBalance,
      JSON.stringify({ species: 'rainbow_eucalyptus', potStyle: 'ceramic', decoration: 'fairy_lights', background: 'mystical_forest', name: 'Momentum Tree' }),
      userId,
    ]
  );

  await client.query(
    `INSERT INTO combined_savings_accounts (
       user_id, account_key, source, institution_name, account_name, account_type,
       account_subtype, mask, current_balance, currency, included_in_combined_savings,
       disconnected, last_synced_at, updated_at
     ) VALUES
       ($1,'demo:hysa','manual','Demo Capital','High-Yield Savings','depository','savings','2042',$2,'USD',TRUE,FALSE,NOW(),NOW()),
       ($1,'demo:brokerage','manual','Demo Brokerage','Index Fund Portfolio','investment','brokerage','8891',$3,'USD',TRUE,FALSE,NOW(),NOW()),
       ($1,'demo:roth','manual','Demo Retirement','Roth IRA','investment','roth','7784',$4,'USD',TRUE,FALSE,NOW(),NOW())`,
    [userId, Math.round(finalBalance * 0.32), Math.round(finalBalance * 0.48), Math.round(finalBalance * 0.20)]
  );

  await client.query(
    `INSERT INTO user_assets (user_id, name, emoji, category, annual_return_pct, description)
     VALUES
       ($1,'S&P 500 Index Fund','📈','investment',8.0,'Demo projection for broad-market investing'),
       ($1,'High-Yield Savings','🏦','cash',4.4,'Demo emergency fund yield'),
       ($1,'Bitcoin DCA','₿','crypto',12.0,'Small hypothetical satellite allocation')`,
    [userId]
  );

  await client.query(
    `INSERT INTO goals (user_id, title, target_amount, created_at)
     VALUES
       ($1,'Emergency fund',5000,NOW() - INTERVAL '5 months'),
       ($1,'Invested vice money',12000,NOW() - INTERVAL '4 months'),
       ($1,'Debt-free buffer',2500,NOW() - INTERVAL '3 months')`,
    [userId]
  );

  await client.query(
    `INSERT INTO user_xp (user_id, total_xp, level, updated_at)
     VALUES ($1, 6200, 8, NOW())
     ON CONFLICT (user_id) DO UPDATE SET total_xp = 6200, level = 8, updated_at = NOW()`,
    [userId]
  );
}

function hashMagicToken(raw) {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

function hashEmailCode(raw) {
  return crypto.createHash('sha256').update(String(raw || '').trim(), 'utf8').digest('hex');
}

function generateEmailCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function createAndSendEmailCode(user, purpose) {
  const code = generateEmailCode();
  const expiresAt = new Date(Date.now() + EMAIL_CODE_EXPIRY_MS);
  await pool.query(
    `UPDATE email_auth_codes
     SET used_at = NOW()
     WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`,
    [user.id, purpose]
  );
  await pool.query(
    `INSERT INTO email_auth_codes (user_id, code_hash, purpose, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [user.id, hashEmailCode(code), purpose, expiresAt]
  );
  await sendOneTimeCodeEmail({
    to: user.email,
    username: user.auth_username,
    code,
    purpose,
  });
}

async function verifyLatestEmailCode({ userId, code, purpose }) {
  const result = await pool.query(
    `SELECT id, code_hash, expires_at, used_at
     FROM email_auth_codes
     WHERE user_id = $1 AND purpose = $2
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [userId, purpose]
  );
  const row = result.rows[0];
  if (!row || row.used_at) return { ok: false, status: 401, error: 'Invalid or expired code.' };
  if (new Date() > new Date(row.expires_at)) {
    return { ok: false, status: 401, error: 'This code has expired. Request a new one.' };
  }
  if (!safeEqual(hashEmailCode(code), row.code_hash)) {
    return { ok: false, status: 401, error: 'Invalid code.' };
  }
  await pool.query('UPDATE email_auth_codes SET used_at = NOW() WHERE id = $1', [row.id]);
  return { ok: true };
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

// POST /api/auth/signup-code/start — create account, then email a one-time verification code
router.post('/signup-code/start', signupLimiter, async (req, res, next) => {
  try {
    const username = sanitizeUsername(req.body?.username);
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    const email = rawEmail || null;

    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters.' });
    }
    if (username.length > 30) {
      return res.status(400).json({ error: 'Username must be 30 characters or fewer.' });
    }
    if (!email || !validateEmail(email)) {
      return res.status(400).json({ error: 'Enter a valid email address for the one-time code.' });
    }

    const taken = await pool.query(
      'SELECT auth_username FROM users WHERE auth_username = $1 LIMIT 1',
      [username]
    );
    if (taken.rows.length > 0) {
      return res.status(409).json({ error: `"${username}" is already taken.` });
    }

    const emailTaken = await pool.query(
      'SELECT id FROM users WHERE email = $1 LIMIT 1', [email]
    );
    if (emailTaken.rows.length > 0) {
      return res.status(409).json({ error: 'That email is already associated with an account.' });
    }

    const result = await pool.query(
      `INSERT INTO users (clerk_user_id, name, auth_username, email, email_verified)
       VALUES ($1, $2, $3, $4, FALSE) RETURNING id, auth_username, email`,
      [`username:${username}`, username, username, email]
    );

    await createAndSendEmailCode(result.rows[0], 'signup');
    res.status(201).json({ ok: true, username, message: 'Check your email for a 6-digit code.' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That username or email is already taken.' });
    }
    next(err);
  }
});

// POST /api/auth/signup-code/verify — verify one-time code and sign in
router.post('/signup-code/verify', signupLimiter, async (req, res, next) => {
  try {
    const username = sanitizeUsername(req.body?.username);
    const code = String(req.body?.code || '').trim();

    if (!username || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Username and 6-digit code required.' });
    }

    const result = await pool.query(
      `SELECT id, auth_username, email FROM users
       WHERE auth_username = $1 AND clerk_user_id = $2 LIMIT 1`,
      [username, `username:${username}`]
    );
    const user = result.rows[0];
    if (!user || !user.email) return res.status(401).json({ error: 'Invalid or expired code.' });

    const verified = await verifyLatestEmailCode({ userId: user.id, code, purpose: 'signup' });
    if (!verified.ok) return res.status(verified.status).json({ error: verified.error });

    await pool.query('UPDATE users SET email_verified = TRUE WHERE id = $1', [user.id]);
    res.json({ jwt: signSession(user.id, user.auth_username), username: user.auth_username });
  } catch (err) { next(err); }
});

// POST /api/auth/code/start — email a one-time sign-in code for an existing account
router.post('/code/start', magicLimiter, async (req, res, next) => {
  try {
    const identifier = String(req.body?.identifier || '').trim().toLowerCase();
    if (!identifier) return res.status(400).json({ error: 'Enter your email or username.' });

    const result = await pool.query(
      `SELECT id, auth_username, email FROM users
       WHERE email = $1 OR auth_username = $2 LIMIT 1`,
      [identifier, sanitizeUsername(identifier)]
    );
    const user = result.rows[0];

    // Prevent account enumeration; only send if a matching account has email.
    if (user?.email) {
      await createAndSendEmailCode(user, 'login');
    }
    res.json({ ok: true, message: 'If that account exists, a one-time code has been sent.' });
  } catch (err) { next(err); }
});

// POST /api/auth/code/verify — verify one-time sign-in code
router.post('/code/verify', loginLimiter, async (req, res, next) => {
  try {
    const identifier = String(req.body?.identifier || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();
    if (!identifier || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Identifier and 6-digit code required.' });
    }

    const result = await pool.query(
      `SELECT id, auth_username, email FROM users
       WHERE email = $1 OR auth_username = $2 LIMIT 1`,
      [identifier, sanitizeUsername(identifier)]
    );
    const user = result.rows[0];
    if (!user?.email) return res.status(401).json({ error: 'Invalid or expired code.' });

    const verified = await verifyLatestEmailCode({ userId: user.id, code, purpose: 'login' });
    if (!verified.ok) return res.status(verified.status).json({ error: verified.error });

    await pool.query('UPDATE users SET email_verified = TRUE WHERE id = $1', [user.id]);
    res.json({ jwt: signSession(user.id, user.auth_username), username: user.auth_username });
  } catch (err) { next(err); }
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

    const client = await pool.connect();
    let user;
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO users (clerk_user_id, name, auth_username) VALUES ($1, $2, $3) RETURNING id, auth_username`,
        [`username:${username}`, 'Demo Investor', username]
      );
      user = result.rows[0];
      await seedRichDemoAccount(client, user.id);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

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
