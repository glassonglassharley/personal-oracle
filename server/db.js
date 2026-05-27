require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

// rejectUnauthorized: false is required for Neon (and most cloud Postgres providers)
// because their cert chain may not be trusted by Node's built-in CA store on Vercel.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 8000,
});

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    clerk_user_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS vices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit_label TEXT NOT NULL DEFAULT 'unit',
    default_price NUMERIC NOT NULL DEFAULT 0,
    emoji TEXT DEFAULT '🔴',
    category TEXT DEFAULT 'Other',
    monthly_budget NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS entries (
    id SERIAL PRIMARY KEY,
    vice_id INTEGER NOT NULL REFERENCES vices(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 0,
    price_per_unit NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    target_amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS challenges (
    id SERIAL PRIMARY KEY,
    challenger_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challengee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_year TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (challenger_id, challengee_id, month_year)
  );

  CREATE TABLE IF NOT EXISTS friendships (
    id SERIAL PRIMARY KEY,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (requester_id, addressee_id)
  );
`;

const MIGRATIONS = `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS companion_type TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS companion_state JSONB;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS nightly_reminders_enabled BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS last_nightly_reminder_date DATE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS last_zero_fill_date DATE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_username TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS username_token_hash TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS users_auth_username_unique ON users (auth_username) WHERE auth_username IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS users_username_token_hash_unique ON users (username_token_hash) WHERE username_token_hash IS NOT NULL;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_session_token_hash TEXT;

  ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_vice_id_date_key;

  CREATE TABLE IF NOT EXISTS plaid_connections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    item_id TEXT NOT NULL,
    institution_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, item_id)
  );

  CREATE TABLE IF NOT EXISTS notification_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS partner_messages (
    id SERIAL PRIMARY KEY,
    friendship_id INTEGER NOT NULL REFERENCES friendships(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (char_length(trim(body)) > 0 AND char_length(body) <= 1000),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS partner_messages_friendship_created_idx
    ON partner_messages (friendship_id, created_at DESC, id DESC);
`;

const { backupEntries } = require('./backup');

async function initDb() {
  await pool.query(SCHEMA);
  // Skip backup on Vercel — /tmp is ephemeral (wiped on every cold start) so
  // the file never survives long enough to be useful as a migration safety net.
  if (!process.env.VERCEL) {
    await backupEntries(pool).catch(err => console.error('Pre-migration backup failed:', err.stack || err.message));
  }
  await pool.query(MIGRATIONS);
  await pool.query('ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_vice_id_date_key');
  await pool.query('DROP INDEX IF EXISTS entries_vice_id_date_key');
  await pool.query('DROP INDEX IF EXISTS entries_vice_id_date_idx');
  await pool.query('DROP INDEX IF EXISTS entries_vice_id_date_unique');
  console.log('DB schema ready');
}

initDb().catch(err => console.error('[DB INIT ERROR]', err.stack || err.message));

module.exports = pool;
