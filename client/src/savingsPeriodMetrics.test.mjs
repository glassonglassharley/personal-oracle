import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSavingsPeriodSummary, findTrackingStartDate } from './savingsPeriodMetrics.js';

const NOW = new Date('2026-09-22T12:00:00.000Z'); // Tue 2026-09-22 in Los Angeles

// Real daily snapshots only — each row carries the snapshot_date the cron writes.
const history = [
  { balance: 2250.00, snapshot_date: '2026-09-22' },
  { balance: 2200.00, snapshot_date: '2026-09-21' },
  { balance: 2000.00, snapshot_date: '2026-09-01' },
  { balance: 1800.00, snapshot_date: '2026-01-01' },
  { balance: 1700.00, snapshot_date: '2025-12-31' },
];

const spendDays = [
  { date: '2026-09-22', spend: 20 },
  { date: '2026-09-21', spend: 80 },
  { date: '2026-09-15', spend: 50 },
  { date: '2026-01-05', spend: 200 },
];

test('buildSavingsPeriodSummary compares real balance changes with vice spend by calendar period', () => {
  const summary = buildSavingsPeriodSummary({
    now: NOW,
    currentBalance: 2296.17,
    history,
    spendDays,
  });

  assert.deepEqual(summary.today, {
    saved: 46.17,
    spent: 20,
    net: 26.17,
    hasBaseline: true,
  });
  assert.deepEqual(summary.week, {
    saved: 96.17,
    spent: 100,
    net: -3.83,
    hasBaseline: true,
  });
  assert.deepEqual(summary.month, {
    saved: 296.17,
    spent: 150,
    net: 146.17,
    hasBaseline: true,
  });
  assert.deepEqual(summary.year, {
    saved: 496.17,
    spent: 350,
    net: 146.17,
    hasBaseline: true,
  });
});

test('buildSavingsPeriodSummary does not invent savings when an earlier balance snapshot is unavailable', () => {
  const summary = buildSavingsPeriodSummary({
    now: NOW,
    currentBalance: 2296.17,
    history: [{ balance: 2296.17, recorded_at: '2026-09-22T10:00:00.000Z' }],
    spendDays,
  });

  assert.equal(summary.today.saved, null);
  assert.equal(summary.today.net, null);
  assert.equal(summary.today.spent, 20);
  assert.equal(summary.today.hasBaseline, false);
});

test('buildSavingsPeriodSummary preserves a negative real balance change', () => {
  const summary = buildSavingsPeriodSummary({
    now: NOW,
    currentBalance: 1900,
    history: [{ balance: 2000, snapshot_date: '2026-09-21' }],
    spendDays: [{ date: '2026-09-22', spend: 25 }],
  });

  assert.equal(summary.today.saved, -100);
  assert.equal(summary.today.spent, 25);
  assert.equal(summary.today.net, -125);
});

test('buildSavingsPeriodSummary treats a post-midnight cron snapshot as the baseline for its Pacific date', () => {
  const summary = buildSavingsPeriodSummary({
    now: NOW,
    currentBalance: 2350,
    history: [{
      balance: 2296.17,
      snapshot_date: '2026-09-22',
      recorded_at: '2026-09-22T08:00:00.000Z',
    }],
    spendDays: [{ date: '2026-09-22', spend: 70 }],
  });

  assert.equal(summary.today.saved, 53.83);
  assert.equal(summary.today.spent, 70);
  assert.equal(summary.today.net, -16.17);
});

test('legacy rows without a snapshot_date never anchor a period baseline, but real mid-period tracking can', () => {
  // The live condition: one real cron snapshot plus pre-cron legacy rows.
  const summary = buildSavingsPeriodSummary({
    now: NOW,
    currentBalance: 5000,
    history: [
      { balance: 5000, snapshot_date: '2026-09-22', recorded_at: '2026-09-22T15:00:00.000Z' },
      { balance: 4870.30, snapshot_date: null, recorded_at: '2026-09-18T17:00:00.000Z' },
      { balance: 3889.43, snapshot_date: null, recorded_at: '2026-08-30T17:00:00.000Z' },
    ],
    spendDays: [],
  });

  assert.equal(summary.today.hasBaseline, true);
  assert.equal(summary.today.saved, 0);

  for (const period of ['week', 'month', 'year']) {
    assert.equal(summary[period].hasBaseline, true, `${period} can use the first real in-period snapshot`);
    assert.equal(summary[period].saved, 0);
    assert.equal(summary[period].net, 0);
  }
});

test('week/month/year use first real snapshot inside the period when tracking starts after the calendar boundary', () => {
  const summary = buildSavingsPeriodSummary({
    now: new Date('2026-09-24T18:00:00.000Z'),
    currentBalance: 2362.02,
    history: [
      { balance: 2343.02, snapshot_date: '2026-09-22', recorded_at: '2026-09-22T08:00:00.000Z' },
      { balance: 2200, snapshot_date: null, recorded_at: '2026-09-18T17:00:00.000Z' },
    ],
    spendDays: [
      { date: '2026-09-21', spend: 100 },
      { date: '2026-09-22', spend: 5 },
      { date: '2026-09-23', spend: 7 },
      { date: '2026-09-24', spend: 2 },
    ],
  });

  for (const period of ['week', 'month', 'year']) {
    assert.equal(summary[period].hasBaseline, true);
    assert.equal(summary[period].saved, 19);
    // Spend before the first real snapshot is outside the measurable window.
    assert.equal(summary[period].spent, 14);
    assert.equal(summary[period].net, 5);
  }
});

test('period boundaries follow America/Los_Angeles rather than UTC or the browser zone', () => {
  // 2026-09-23T05:00Z is still Tue 2026-09-22 22:00 in Los Angeles, so the
  // Pacific day has not rolled over yet.
  const summary = buildSavingsPeriodSummary({
    now: new Date('2026-09-23T05:00:00.000Z'),
    currentBalance: 2300,
    history: [{ balance: 2250, snapshot_date: '2026-09-22' }],
    spendDays: [{ date: '2026-09-22', spend: 10 }],
  });

  assert.equal(summary.today.hasBaseline, true);
  assert.equal(summary.today.saved, 50);
  assert.equal(summary.today.spent, 10);
});

test('findTrackingStartDate returns the earliest real snapshot and ignores legacy rows', () => {
  assert.equal(findTrackingStartDate(history), '2025-12-31');
  assert.equal(findTrackingStartDate([
    { balance: 5000, snapshot_date: '2026-09-22' },
    { balance: 4870.30, recorded_at: '2026-09-18T17:00:00.000Z' },
  ]), '2026-09-22');
  assert.equal(findTrackingStartDate([{ balance: 10, recorded_at: '2026-01-01T00:00:00.000Z' }]), null);
  assert.equal(findTrackingStartDate([]), null);
});
