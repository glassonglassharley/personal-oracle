require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Log missing critical env vars at startup so Vercel Function logs show the root cause
const REQUIRED_ENV = ['DATABASE_URL', 'CLERK_SECRET_KEY', 'CLERK_PUBLISHABLE_KEY'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error('[STARTUP] Missing required environment variables:', missing.join(', '));
}
const OPTIONAL_ENV = [
  'VITE_CLERK_PUBLISHABLE_KEY', 'PLAID_CLIENT_ID', 'PLAID_SECRET', 'PLAID_ENV',
  'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'ANTHROPIC_API_KEY', 'CRON_SECRET', 'ADMIN_SECRET',
  'JWT_SECRET', 'APP_URL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM',
];
const missingOptional = OPTIONAL_ENV.filter(k => !process.env[k]);
if (missingOptional.length) {
  console.warn('[STARTUP] Optional env vars not set (some features may fail):', missingOptional.join(', '));
}

const express = require('express');
const cors = require('cors');
const { clerkMiddleware, requireAuth } = require('@clerk/express');
const { ensureUser } = require('./middleware/auth');
const pool = require('./db');
const {
  router: usernameAuthRouter,
  sanitizeUsername,
  hashToken,
  validToken,
  safeEqual,
} = require('./routes/usernameAuth');
const {
  router: phantomAuthRouter,
  hashToken: hashWalletToken,
  safeEqual: safeEqualWallet,
} = require('./routes/phantomAuth');
const { router: authRouter, verifySession } = require('./routes/auth');

const app = express();

// Digital Asset Links — served unauthenticated for TWA domain verification
app.get('/.well-known/assetlinks.json', (req, res) => {
  res.sendFile(require('path').join(__dirname, '..', 'android', 'assetlinks.json'));
});

function validWalletToken(token) {
  return /^vtw_[A-Za-z0-9_-]{40,}$/.test(String(token || ''));
}

async function usernameOrClerkAuth(req, res, next) {
  // Wallet (Phantom) auth
  const walletAddress = String(req.get('X-Wallet-Address') || '').trim();
  const walletToken = String(req.get('X-Wallet-Token') || '').trim();
  if (walletAddress || walletToken) {
    if (!walletAddress || !validWalletToken(walletToken)) {
      return res.status(401).json({ error: 'Wallet session token required.' });
    }
    try {
      const result = await pool.query(
        'SELECT wallet_session_token_hash FROM users WHERE clerk_user_id = $1 LIMIT 1',
        [`wallet:${walletAddress}`]
      );
      const storedHash = result.rows[0]?.wallet_session_token_hash;
      if (!storedHash || !safeEqualWallet(hashWalletToken(walletToken), storedHash)) {
        return res.status(401).json({ error: 'Invalid or expired wallet session.' });
      }
      req.auth = { userId: `wallet:${walletAddress}` };
      req.walletAuth = { publicKey: walletAddress };
      return next();
    } catch (err) {
      return next(err);
    }
  }

  // Legacy username/token auth (backward compat — still accepted while migration is in progress)
  const username = sanitizeUsername(req.get('X-Username-Auth'));
  const legacyToken = String(req.get('X-Username-Token') || '').trim();
  if (username || legacyToken) {
    if (!username || !validToken(legacyToken)) {
      return res.status(401).json({ error: 'Username access token required.' });
    }
    try {
      const result = await pool.query(
        'SELECT username_token_hash FROM users WHERE auth_username = $1 AND clerk_user_id = $2 LIMIT 1',
        [username, `username:${username}`]
      );
      const tokenHash = result.rows[0]?.username_token_hash;
      if (!tokenHash || !safeEqual(hashToken(legacyToken), tokenHash)) {
        return res.status(401).json({ error: 'Invalid username access token.' });
      }
      req.auth = { userId: `username:${username}` };
      req.usernameAuth = { username };
      return next();
    } catch (err) {
      return next(err);
    }
  }

  // VT JWT — check Authorization: Bearer header before falling through to Clerk
  const authHeader = String(req.get('Authorization') || '');
  if (authHeader.startsWith('Bearer ') && process.env.JWT_SECRET) {
    const bearerToken = authHeader.slice(7).trim();
    const payload = verifySession(bearerToken);
    if (payload && payload.sub) {
      req.auth = { userId: payload.sub };
      req.vtAuth = { userId: payload.sub, username: payload.username };
      return next();
    }
    // JWT present but invalid — fall through to Clerk (Clerk JWTs also use Bearer)
  }

  return requireAuth()(req, res, next);
}

const ALLOWED_ORIGINS = (() => {
  const env = process.env.ALLOWED_ORIGINS || process.env.APP_URL || '';
  const origins = env.split(',').map(s => s.trim()).filter(Boolean);
  if (!origins.length) {
    // Dev fallback: allow localhost on common ports
    return [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];
  }
  return origins;
})();

// personal-oracle-draft calls GET /api/oracle/summary cross-origin with a
// Clerk session JWT (no shared secret). Scoped to that one path only —
// every other path keeps the ALLOWED_ORIGINS behavior below, unchanged.
const ORACLE_ORIGIN = process.env.ORACLE_ORIGIN || 'https://personal-oracle-draft.vercel.app';
// Additive, not a replacement for the exact prod match above — lets
// personal-oracle-draft's local Ollama testing flow (npm run dev) reach
// /api/oracle/* from a localhost dev server. Same regex ALLOWED_ORIGINS
// already uses for its own dev fallback (see above). Scoped to localhost
// only, deliberately not widened to 127.0.0.1 or any other host.
const ORACLE_LOCALHOST_ORIGIN = /^http:\/\/localhost(:\d+)?$/;

// Debt Assassination writes to /api/debt/* directly from the browser with a
// Clerk JWT, same pattern as ORACLE_ORIGIN above. personal-oracle-draft also
// reads /api/debt/* the same way it already reads /api/oracle/* — so this
// branch admits both origins, not just one. Deliberately NOT extended to
// /api/plaid — Vice Tracker's own frontend already reaches that through the
// generic ALLOWED_ORIGINS branch below, and scoping it here risks locking
// that out; Debt's origin is added to ALLOWED_ORIGINS instead.
const DEBT_ORIGIN = process.env.DEBT_ORIGIN || 'https://debt-assassination.vercel.app';

// Pre-Game writes to /api/income/* directly from the browser with its own
// Clerk JWT (added in the sync_id -> Clerk migration), same pattern as
// DEBT_ORIGIN above. personal-oracle-draft reads /api/income/* the same way
// it already reads /api/debt/* and /api/oracle/*. Confirmed production
// domain via the Vercel API (project prj_i2lxwCqDjLsuovLlhYWJQgYnIkC6) —
// not guessed.
const INCOME_ORIGIN = process.env.INCOME_ORIGIN || 'https://pre-game-umber.vercel.app';

app.use(cors((req, callback) => {
  if (req.path.startsWith('/api/oracle')) {
    const allowed = req.headers.origin === ORACLE_ORIGIN || ORACLE_LOCALHOST_ORIGIN.test(req.headers.origin || '');
    return callback(allowed ? null : new Error('Not allowed by CORS'), {
      origin: allowed ? req.headers.origin : false,
      credentials: true,
      allowedHeaders: ['Authorization', 'Content-Type'],
      methods: ['GET', 'POST', 'OPTIONS'],
    });
  }

  if (req.path.startsWith('/api/debt')) {
    const allowed = req.headers.origin === DEBT_ORIGIN || req.headers.origin === ORACLE_ORIGIN;
    return callback(allowed ? null : new Error('Not allowed by CORS'), {
      origin: allowed ? req.headers.origin : false,
      credentials: true,
      allowedHeaders: ['Authorization', 'Content-Type'],
      methods: ['GET', 'POST', 'OPTIONS'],
    });
  }

  if (req.path.startsWith('/api/income')) {
    const allowed = req.headers.origin === INCOME_ORIGIN || req.headers.origin === ORACLE_ORIGIN;
    return callback(allowed ? null : new Error('Not allowed by CORS'), {
      origin: allowed ? req.headers.origin : false,
      credentials: true,
      allowedHeaders: ['Authorization', 'Content-Type'],
      methods: ['GET', 'POST', 'OPTIONS'],
    });
  }

  // Allow same-origin / non-browser requests (Siri Shortcuts, server-to-server)
  if (!req.headers.origin) return callback(null, { origin: true, credentials: true });
  const allowed = ALLOWED_ORIGINS.some(o =>
    o instanceof RegExp ? o.test(req.headers.origin) : o === req.headers.origin
  );
  callback(allowed ? null : new Error('Not allowed by CORS'), { origin: allowed, credentials: true });
}));
app.use(express.json());
app.use(clerkMiddleware());

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'connected', ts: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'error', error: err.message });
  }
});

app.use('/api/cron', require('./routes/cron'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/auth/username', usernameAuthRouter); // kept for backward compat / token-exchange
app.use('/api/auth/phantom', phantomAuthRouter);
app.use('/api/auth', authRouter);
// voice-log uses its own bearer-token auth (SHA-256 lookup in voice_tokens), not Clerk/JWT
app.use('/api/voice-log', require('./routes/voice').logRouter);
app.use('/api', usernameOrClerkAuth, ensureUser);

app.use('/api/users',   require('./routes/users'));
app.use('/api/vices',   require('./routes/vices'));
app.use('/api/entries', require('./routes/entries'));
app.use('/api/stats',   require('./routes/stats'));
app.use('/api/savings',  require('./routes/savings'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/partners', require('./routes/partners'));
app.use('/api/goals',   require('./routes/goals'));
app.use('/api/wrapped', require('./routes/wrapped'));
app.use('/api/companion', require('./routes/companion'));
app.use('/api/plaid',    require('./routes/plaid'));
app.use('/api/badges',        require('./routes/badges'));
app.use('/api/xp',            require('./routes/xp'));
app.use('/api/insights',      require('./routes/insights'));
app.use('/api/assets',        require('./routes/assets'));
app.use('/api/voice-tokens',  require('./routes/voice').tokenRouter);
app.use('/api/account',       require('./routes/account'));
app.use('/api/oracle',        require('./routes/oracle'));
app.use('/api/training',      require('./routes/training'));
app.use('/api/debt',          require('./routes/debt'));
app.use('/api/income',        require('./routes/income'));

app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  console.error(
    `[API ERROR] ${req.method} ${req.path}`,
    `status=${status}`,
    `user=${req.auth?.userId ?? 'unauthenticated'}`,
    '\n' + (err.stack || err.message || err),
  );
  res.status(status).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
