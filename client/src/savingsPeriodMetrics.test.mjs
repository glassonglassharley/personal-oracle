import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSavingsPeriodSummary } from './savingsPeriodMetrics.js';

const NOW = new Date('2026-09-22T12:00:00.000Z');

const history = [
  { balance: 2296.17, recorded_at: '2026-09-22T10:00:00.000Z' },
  { balance: 2250.00, recorded_at: '2026-09-22T00:00:00.000Z' },
  { balance: 2200.00, recorded_at: '2026-09-20T23:00:00.000Z' },
  { balance: 2000.00, recorded_at: '2026-09-01T00:00:00.000Z' },
  { balance: 1800.00, recorded_at: '2026-01-01T00:00:00.000Z' },
  { balance: 1700.00, recorded_at: '2025-12-31T23:00:00.000Z' },
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
    history: [{ balance: 2000, recorded_at: '2026-09-21T20:00:00.000Z' }],
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
