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

  ALTER TABLE entries ADD COLUMN IF NOT EXISTS note TEXT;
  ALTER TABLE entries ADD COLUMN IF NOT EXISTS import_source TEXT;
  ALTER TABLE entries ADD COLUMN IF NOT EXISTS external_transaction_id TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS entries_external_transaction_unique
    ON entries (external_transaction_id)
    WHERE external_transaction_id IS NOT NULL;
  ALTER TABLE vices ADD COLUMN IF NOT EXISTS plaid_categories TEXT DEFAULT '[]';

  CREATE TABLE IF NOT EXISTS user_xp (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS insights_cache (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, type)
  );

  ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_streak_risk BOOLEAN DEFAULT TRUE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_streak_milestone BOOLEAN DEFAULT TRUE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_badge_earned BOOLEAN DEFAULT TRUE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_level_up BOOLEAN DEFAULT TRUE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_weekly_summary BOOLEAN DEFAULT TRUE;
  ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_vice_id_date_key;

  CREATE TABLE IF NOT EXISTS badges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id TEXT NOT NULL,
    vice_id INTEGER REFERENCES vices(id) ON DELETE SET NULL,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, badge_id)
  );

  CREATE TABLE IF NOT EXISTS plaid_connections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    item_id TEXT NOT NULL,
    institution_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, item_id)
  );

  CREATE TABLE IF NOT EXISTS plaid_transaction_actions (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('imported', 'skipped', 'deleted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, transaction_id)
  );
  CREATE INDEX IF NOT EXISTS plaid_transaction_actions_user_action_idx
    ON plaid_transaction_actions (user_id, action);

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

  ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
  CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email) WHERE email IS NOT NULL;

  CREATE TABLE IF NOT EXISTS magic_links (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL DEFAULT 'login',
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS magic_links_user_id_idx ON magic_links (user_id);

  CREATE TABLE IF NOT EXISTS email_auth_codes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN ('signup', 'login')),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS email_auth_codes_user_purpose_idx ON email_auth_codes (user_id, purpose, created_at DESC);

  CREATE TABLE IF NOT EXISTS user_assets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '📦',
    category TEXT NOT NULL DEFAULT 'investment',
    annual_return_pct FLOAT NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS user_assets_user_id_idx ON user_assets (user_id);

  CREATE TABLE IF NOT EXISTS voice_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    label TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE users ADD COLUMN IF NOT EXISTS savings_balance NUMERIC NOT NULL DEFAULT 0;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS savings_updated_at TIMESTAMPTZ;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_privacy JSONB NOT NULL DEFAULT '{"show_vices":true,"show_spend":true,"show_streak":true,"show_xp":true}'::jsonb;

  -- First sync slice: one row per (user, date, exercise), reps is an absolute
  -- daily total (matches Training Log's own semantics) so re-syncing upserts.
  CREATE TABLE IF NOT EXISTS training_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    exercise TEXT NOT NULL,
    reps INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'training-log',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, date, exercise)
  );

  -- One row per user: Training Log's config.customExercises (real display
  -- names for custom exercise ids) and config.goals, relayed on save_config
  -- so Oracle can render real names/goals instead of raw ids and defaults.
  CREATE TABLE IF NOT EXISTS training_config (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    custom_exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
    goals JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- Debt Assassination sync, mirroring Training Log's shape. debt_id is a
  -- per-user local id (Debt Assassination's own incrementing id, not
  -- globally unique), and balance is directly mutable in place (paying it
  -- down updates the same row) unlike training reps, so this upserts on
  -- (user_id, debt_id) rather than appending.
  CREATE TABLE IF NOT EXISTS debts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    debt_id INTEGER NOT NULL,
    lender TEXT NOT NULL,
    original_balance NUMERIC NOT NULL DEFAULT 0,
    balance NUMERIC NOT NULL DEFAULT 0,
    limit_amount NUMERIC NOT NULL DEFAULT 0,
    apr NUMERIC,
    min_payment NUMERIC,
    autopay_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    autopay_amount NUMERIC,
    autopay_due_day INTEGER,
    source TEXT NOT NULL DEFAULT 'debt-assassination',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, debt_id)
  );

  -- One row per user: Debt Assassination's creditScore/playerHealth/
  -- harleyDefiSplit, same upsert-in-place semantics as training_config.
  CREATE TABLE IF NOT EXISTS debt_profile (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    credit_score INTEGER,
    player_health INTEGER,
    harley_defi_split JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- Append-only payment history — unlike debts/debt_profile, individual
  -- payments are immutable historical facts once logged, so this never
  -- upserts. Powers cross-domain correlation (e.g. paydown vs. vice
  -- relapses) that a current-state-only debts table can't answer.
  CREATE TABLE IF NOT EXISTS debt_payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    debt_id INTEGER NOT NULL,
    amount NUMERIC NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL,
    source TEXT NOT NULL DEFAULT 'debt-assassination',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS debt_payments_user_id_idx ON debt_payments (user_id, paid_at DESC);

  -- Append-only credit score history, same shape/rationale as debt_payments:
  -- each reading is an immutable historical fact once logged, never upserted.
  CREATE TABLE IF NOT EXISTS score_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    source TEXT NOT NULL DEFAULT 'debt-assassination',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS score_history_user_id_idx ON score_history (user_id, recorded_at DESC);

  -- Pre-Game (Income) sync. source_id/task_id/etc are pre-game's own
  -- client-generated ids (strings, not integers like debt_id) — upsert on
  -- (user_id, that id), same rationale as debts: these represent current
  -- mutable state, not historical events. "source" here means "which app
  -- synced this row" (always 'pre-game', matching the debts/training_entries
  -- convention); pre-game's own per-item origin field (gmail/calendar/manual)
  -- is named "origin" instead, to avoid colliding with that convention.
  CREATE TABLE IF NOT EXISTS income_sources (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'work',
    pay_type TEXT,
    pay NUMERIC,
    hours NUMERIC,
    w2_pay_mode TEXT,
    hourly_rate NUMERIC,
    salary_amount NUMERIC,
    salary_period TEXT,
    instrument TEXT,
    principal NUMERIC,
    rate NUMERIC,
    recurring_amount NUMERIC,
    recurring_frequency TEXT,
    source TEXT NOT NULL DEFAULT 'pre-game',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, source_id)
  );

  CREATE TABLE IF NOT EXISTS income_tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL,
    text TEXT NOT NULL,
    done BOOLEAN NOT NULL DEFAULT FALSE,
    type TEXT NOT NULL DEFAULT 'daily',
    category TEXT,
    completed_at TIMESTAMPTZ,
    scheduled_at TIMESTAMPTZ,
    completed_dates JSONB NOT NULL DEFAULT '[]'::jsonb,
    source TEXT NOT NULL DEFAULT 'pre-game',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, task_id)
  );

  CREATE TABLE IF NOT EXISTS income_opportunities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opportunity_id TEXT NOT NULL,
    title TEXT NOT NULL,
    company_or_client TEXT,
    stage TEXT NOT NULL DEFAULT 'lead',
    origin TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    source TEXT NOT NULL DEFAULT 'pre-game',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, opportunity_id)
  );

  CREATE TABLE IF NOT EXISTS income_followups (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followup_id TEXT NOT NULL,
    title TEXT NOT NULL,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'open',
    origin TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    source TEXT NOT NULL DEFAULT 'pre-game',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, followup_id)
  );

  -- Append-only, like debt_payments/score_history: an income event is an
  -- immutable historical fact once logged. Unlike debt_payments, pre-game's
  -- own sync effect resends its FULL current arrays on every debounced state
  -- change (not one call per new event), so this needs a uniqueness
  -- constraint + ON CONFLICT DO NOTHING in the route — otherwise the same
  -- event would be re-inserted as a duplicate on every unrelated edit.
  CREATE TABLE IF NOT EXISTS income_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL,
    title TEXT NOT NULL,
    amount NUMERIC,
    event_date DATE NOT NULL,
    opportunity_id TEXT,
    origin TEXT,
    notes TEXT,
    source TEXT NOT NULL DEFAULT 'pre-game',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, event_id)
  );
  CREATE INDEX IF NOT EXISTS income_events_user_id_idx ON income_events (user_id, event_date DESC);

  -- Append-only, like debt_payments/score_history: each row is an immutable
  -- snapshot of the user's savings balance at the moment it was saved (manual
  -- edit or bank sync). Never backfilled or simulated — history only grows
  -- forward from real saves.
  CREATE TABLE IF NOT EXISTS savings_balance_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance NUMERIC NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS savings_balance_history_user_id_idx ON savings_balance_history (user_id, recorded_at DESC);
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

// initDb is exported, not invoked here — importing this module must be side-effect
// free (no connection, no migration). The server entrypoint calls pool.initDb()
// explicitly during boot.
pool.initDb = initDb;

module.exports = pool;
