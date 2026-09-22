const COMBINED_ACCOUNT_ID = '__combined__';
const SNAPSHOT_TIMEZONE = 'America/Los_Angeles';

function pacificSnapshotDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SNAPSHOT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function writeDailySavingsSnapshots(db, now = new Date()) {
  const capturedAt = now.toISOString();
  const snapshotDate = pacificSnapshotDate(now);
  const result = await db.query(
    `WITH included_accounts AS (
       SELECT
         user_id,
         account_key AS account_id,
         current_balance::numeric AS balance
       FROM combined_savings_accounts
       WHERE included_in_combined_savings = TRUE
         AND disconnected = FALSE
         AND current_balance IS NOT NULL
     ), snapshot_rows AS (
       SELECT
         user_id,
         account_id,
         balance,
         'daily_account'::text AS source
       FROM included_accounts
       UNION ALL
       SELECT
         user_id,
         $3::text AS account_id,
         SUM(balance)::numeric AS balance,
         'daily_combined'::text AS source
       FROM included_accounts
       GROUP BY user_id
     ), upserted AS (
       INSERT INTO savings_balance_history (
         user_id,
         account_id,
         balance,
         snapshot_date,
         captured_at,
         recorded_at,
         source
       )
       SELECT user_id, account_id, balance, $1::date, $2::timestamptz, $2::timestamptz, source
       FROM snapshot_rows
       ON CONFLICT (user_id, account_id, snapshot_date)
         WHERE account_id IS NOT NULL AND snapshot_date IS NOT NULL
       DO UPDATE SET
         balance = EXCLUDED.balance,
         captured_at = EXCLUDED.captured_at,
         recorded_at = EXCLUDED.recorded_at,
         source = EXCLUDED.source
       RETURNING account_id
     )
     SELECT
       COUNT(*) FILTER (WHERE account_id <> $3)::int AS account_rows,
       COUNT(*) FILTER (WHERE account_id = $3)::int AS combined_rows
     FROM upserted`,
    [snapshotDate, capturedAt, COMBINED_ACCOUNT_ID]
  );

  const accountRows = Number(result.rows[0]?.account_rows || 0);
  const combinedRows = Number(result.rows[0]?.combined_rows || 0);
  return {
    snapshot_date: snapshotDate,
    captured_at: capturedAt,
    rows_written: accountRows + combinedRows,
    account_rows: accountRows,
    combined_rows: combinedRows,
  };
}

module.exports = {
  COMBINED_ACCOUNT_ID,
  SNAPSHOT_TIMEZONE,
  pacificSnapshotDate,
  writeDailySavingsSnapshots,
};
