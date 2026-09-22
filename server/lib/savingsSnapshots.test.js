const test = require('node:test');
const assert = require('node:assert/strict');
const {
  COMBINED_ACCOUNT_ID,
  pacificSnapshotDate,
  writeDailySavingsSnapshots,
} = require('./savingsSnapshots');

test('pacificSnapshotDate uses the America/Los_Angeles calendar date in PDT and PST', () => {
  assert.equal(pacificSnapshotDate(new Date('2026-09-22T08:00:00.000Z')), '2026-09-22');
  assert.equal(pacificSnapshotDate(new Date('2026-11-02T08:00:00.000Z')), '2026-11-02');
  assert.equal(pacificSnapshotDate(new Date('2026-11-02T07:30:00.000Z')), '2026-11-01');
});

test('writeDailySavingsSnapshots upserts account and combined rows for one Pacific date', async () => {
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rowCount: 7, rows: [{ account_rows: 5, combined_rows: 2 }] };
    },
  };
  const capturedAt = new Date('2026-09-22T08:00:00.000Z');

  const result = await writeDailySavingsSnapshots(db, capturedAt);

  assert.deepEqual(calls[0].params, ['2026-09-22', capturedAt.toISOString(), COMBINED_ACCOUNT_ID]);
  assert.match(calls[0].sql, /included_in_combined_savings = TRUE/);
  assert.match(calls[0].sql, /disconnected = FALSE/);
  assert.match(calls[0].sql, /ON CONFLICT \(user_id, account_id, snapshot_date\)/);
  assert.match(calls[0].sql, /DO UPDATE SET/);
  assert.deepEqual(result, {
    snapshot_date: '2026-09-22',
    captured_at: capturedAt.toISOString(),
    rows_written: 7,
    account_rows: 5,
    combined_rows: 2,
  });
});
