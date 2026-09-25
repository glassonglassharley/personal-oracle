// Run: node --test server/lib/treeGrowth.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('./treeGrowth');

const DAY = 86400000;
const T0 = Date.parse('2026-09-24T12:00:00Z');

function days(start, n, clean = true) {
  const out = [];
  const d = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < n; i++) {
    out.push({ date: d.toISOString().slice(0, 10), clean: typeof clean === 'function' ? clean(i) : clean });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

test('target grows with money and consistency, saturating at 1', () => {
  assert.equal(G.growthTarget({}), 0);
  const a = G.growthTarget({ moneyMoved: 100, loggedDays: 10, bestStreak: 3 });
  const b = G.growthTarget({ moneyMoved: 1000, loggedDays: 100, bestStreak: 30 });
  assert.ok(b > a && a > 0);
  assert.equal(G.growthTarget({ moneyMoved: 1e9, loggedDays: 1e5, bestStreak: 1e5 }), 1);
  // Both halves are needed for a full tree.
  assert.ok(G.growthTarget({ moneyMoved: 1e9 }) <= 0.55 + 1e-9);
  assert.ok(G.growthTarget({ loggedDays: 1e5, bestStreak: 1e5 }) <= 0.45 + 1e-9);
});

test('held savings ignores a one-day spike', () => {
  const series = [100, 100, 100, 100, 100, 100, 100, 100];
  assert.equal(G.heldSavings([...series, 1000000], 100), 100);
  assert.equal(G.heldSavings(series, 100), 100);
  // A balance held for a week counts.
  assert.equal(G.heldSavings([100, 900, 900, 900, 900, 900, 900, 900], 900), 900);
  // Short history: the minimum of what exists.
  assert.equal(G.heldSavings([500, 400], 450), 400);
  assert.equal(G.heldSavings([], undefined), 0);
});

test('ratchet: growth never decreases', () => {
  let r = G.ratchet({ g: 0.5, at: new Date(T0).toISOString() }, 0.1, T0 + DAY, 0);
  assert.equal(r.state.g, 0.5);
  r = G.ratchet(r.state, 0, T0 + 5 * DAY, 0);
  assert.equal(r.state.g, 0.5);
});

test('ratchet: growth rate is capped, and idle time banks at most two days', () => {
  const start = { g: 0.1, at: new Date(T0).toISOString() };
  const oneDay = G.ratchet(start, 1, T0 + DAY, 0);
  assert.ok(Math.abs(oneDay.state.g - (0.1 + G.MAX_DAILY_GAIN)) < 1e-6);
  const longIdle = G.ratchet(start, 1, T0 + 60 * DAY, 0);
  assert.ok(Math.abs(longIdle.state.g - (0.1 + G.MAX_DAILY_GAIN * G.MAX_CREDIT_DAYS)) < 1e-6);
  // Refreshing repeatedly within a day can't beat the daily cap.
  let s = start;
  for (let i = 1; i <= 24; i++) s = G.ratchet(s, 1, T0 + i * 3600000, 0).state;
  assert.ok(s.g <= 0.1 + G.MAX_DAILY_GAIN + 1e-6, `got ${s.g}`);
});

test('consistency stats: best streak survives a relapse', () => {
  const log = days('2026-08-01', 20, i => i !== 12);
  const s = G.consistencyStats(log, '2026-08-20');
  assert.equal(s.loggedDays, 20);
  assert.equal(s.bestStreak, 12);
  assert.equal(s.streak, 7);
});

test('health: dormant when not logging, recovers when back on track, never below floor', () => {
  const idle = G.healthFrom({ logged7: 0, clean7: 0, accountAgeDays: 60 });
  const relapsing = G.healthFrom({ logged7: 7, clean7: 0, accountAgeDays: 60 });
  const clean = G.healthFrom({ logged7: 7, clean7: 7, accountAgeDays: 60 });
  assert.ok(idle >= 0.25 && idle < relapsing && relapsing < clean);
  assert.equal(clean, 1);
  // Honest logging of a slip still keeps the tree fairly healthy: no shaming.
  assert.ok(relapsing > 0.6);
  // Day-one accounts are not dormant.
  assert.ok(G.healthFrom({ logged7: 0, clean7: 0, accountAgeDays: 0.5 }) > 0.8);
});

test('legacy users start at their old stage floor; new companions start at 0', () => {
  const legacy = G.evaluateTree({ species: 'oak', legacySavings: 600, days: [], today: '2026-09-24', stored: null }, T0);
  assert.equal(legacy.state.g, G.legacyFloor('oak', 600));
  assert.equal(G.legacyStage(600), 4);
  const fresh = G.evaluateTree({ species: 'oak', legacySavings: 600, days: [], today: '2026-09-24', stored: { v: 1, g: 0, at: new Date(T0).toISOString(), reached: {}, celebrated: [] } }, T0);
  assert.equal(fresh.state.g, 0);
});

test('legacy users do not get a burst of milestone animations on deploy', () => {
  const r = G.evaluateTree({
    species: 'oak', legacySavings: 2000, savingsSeries: [2000, 2000, 2000], currentSavings: 2000,
    days: days('2026-06-01', 60), today: '2026-07-30', accountCreatedAt: '2026-06-01T00:00:00Z', stored: null,
  }, Date.parse('2026-07-30T12:00:00Z'));
  assert.ok(Object.keys(r.state.reached).length > 3);
  assert.deepEqual(r.view.pendingCelebrations, []);
});

test('a newly reached milestone is pending until acknowledged, then never again', () => {
  const stored = { v: 1, g: 0.2, at: new Date(T0 - DAY).toISOString(), reached: {}, celebrated: [] };
  const inputs = { species: 'oak', days: days('2026-09-10', 15), today: '2026-09-24', accountCreatedAt: '2026-09-01T00:00:00Z', stored };
  const r1 = G.evaluateTree(inputs, T0);
  assert.ok(r1.view.pendingCelebrations.some(p => p.key === 'first_bloom'));
  const acked = G.markCelebrated(r1.state, r1.view.pendingCelebrations.map(p => p.key));
  const r2 = G.evaluateTree({ ...inputs, stored: acked }, T0 + 3600000);
  assert.deepEqual(r2.view.pendingCelebrations, []);
  // Unknown or unreached keys can't be injected.
  const bogus = G.markCelebrated(acked, ['not_a_milestone', 'ancient']);
  assert.equal(bogus.celebrated.includes('not_a_milestone'), false);
  assert.equal(bogus.celebrated.includes('ancient'), false);
});

test('milestones and features are permanent even if savings later fall', () => {
  let stored = { v: 1, g: 0.3, at: new Date(T0 - DAY).toISOString(), reached: {}, celebrated: [] };
  const base = { species: 'apple', days: [], today: '2026-09-24', accountCreatedAt: '2026-01-01T00:00:00Z' };
  const rich = G.evaluateTree({ ...base, savingsSeries: [600, 600, 600, 600, 600, 600, 600], currentSavings: 600, stored }, T0);
  assert.equal(rich.view.features.fruit, 0.5);
  stored = rich.state;
  const poor = G.evaluateTree({ ...base, savingsSeries: [], currentSavings: 0, stored }, T0 + DAY);
  assert.equal(poor.view.features.fruit, 0.5);
  assert.ok(poor.state.g >= rich.state.g);
});

test('seed base is stable per user', () => {
  assert.equal(G.seedBase(42), G.seedBase(42));
  assert.notEqual(G.seedBase(42), G.seedBase(43));
});
