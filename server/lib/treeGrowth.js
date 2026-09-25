// Tree companion growth model. Pure functions only (no DB); the companion
// route gathers the inputs and persists the returned state.
//
// growth  = 0.55 * moneyScore + 0.45 * consistencyScore, then
//           ratcheted: stored peak never decreases, and may rise by at most
//           MAX_DAILY_GAIN per elapsed day (idle time banks at most
//           MAX_CREDIT_DAYS), so a one-day balance spike can't max a tree.
// health  = recent logging (last 7 days), never below HEALTH_FLOOR.
//
// Nothing here uses projected "money you would have spent" math: money is
// savings actually held (7-snapshot rolling minimum) plus debt actually paid.

const crypto = require('crypto');
const LEGACY_FLOORS = require('./legacyTreeFloors.json');

const DAY_MS = 86400000;
const MAX_DAILY_GAIN = 0.06;
const MAX_CREDIT_DAYS = 2;
const HOLD_WINDOW = 7;
const HEALTH_FLOOR = 0.25;
const MONEY_SATURATION = 5000;
const LOGGED_DAYS_SATURATION = 365;
const STREAK_SATURATION = 90;
const NEW_GROWTH_DAYS = 7;

const MATURITY = [
  { at: 0, key: 'seedling', name: 'Seedling' },
  { at: 0.1, key: 'sprout', name: 'Sprout' },
  { at: 0.25, key: 'sapling', name: 'Sapling' },
  { at: 0.45, key: 'young', name: 'Young Tree' },
  { at: 0.65, key: 'mature', name: 'Mature' },
  { at: 0.9, key: 'ancient', name: 'Ancient' },
];

// Order matters: it is the order milestones are celebrated and listed in.
const MILESTONES = [
  { key: 'sprout', text: 'Sprouted its first real leaves', test: s => s.growth >= 0.1 },
  { key: 'first_bloom', text: 'First blossoms: a 7-day clean streak', test: s => s.bestStreak >= 7 },
  { key: 'sapling', text: 'Grew into a sapling', test: s => s.growth >= 0.25 },
  { key: 'ring_1', text: 'First growth ring: one month together', test: s => s.monthsActive >= 1 },
  { key: 'first_fruit', text: 'First fruit: $500 moved', test: s => s.moneyMoved >= 500 },
  { key: 'full_bloom', text: 'Full bloom: a 30-day clean streak', test: s => s.bestStreak >= 30 },
  { key: 'young', text: 'Became a young tree', test: s => s.growth >= 0.45 },
  { key: 'ring_3', text: 'Three growth rings', test: s => s.monthsActive >= 3 },
  { key: 'ring_6', text: 'Six growth rings: half a year', test: s => s.monthsActive >= 6 },
  { key: 'mature', text: 'Reached maturity', test: s => s.growth >= 0.65 },
  { key: 'harvest', text: 'A full harvest: $2,500 moved', test: s => s.moneyMoved >= 2500 },
  { key: 'ring_12', text: 'Twelve growth rings: a full year', test: s => s.monthsActive >= 12 },
  { key: 'ancient', text: 'Became an ancient tree', test: s => s.growth >= 0.9 },
  { key: 'ring_24', text: 'Twenty-four rings: two years rooted', test: s => s.monthsActive >= 24 },
];
const MILESTONE_KEYS = new Set(MILESTONES.map(m => m.key));

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// Diminishing returns: early progress moves the tree a lot, later progress
// keeps it moving but more slowly, and k is where the score reaches 1.
function saturate(x, k) {
  if (!(x > 0)) return 0;
  return Math.min(1, Math.log1p(x) / Math.log1p(k));
}

function moneyScore(moneyMoved) {
  return saturate(moneyMoved / 40, MONEY_SATURATION / 40);
}

function consistencyScore(loggedDays, bestStreak) {
  return 0.6 * saturate(loggedDays, LOGGED_DAYS_SATURATION) + 0.4 * saturate(bestStreak, STREAK_SATURATION);
}

function growthTarget({ moneyMoved = 0, loggedDays = 0, bestStreak = 0 }) {
  return clamp01(0.55 * moneyScore(moneyMoved) + 0.45 * consistencyScore(loggedDays, bestStreak));
}

// Savings only count once they have been held: the best 7-snapshot rolling
// minimum. With fewer than 7 samples, the minimum of what exists.
function heldSavings(series = [], current) {
  const samples = series.map(Number).filter(Number.isFinite);
  if (Number.isFinite(Number(current))) samples.push(Number(current));
  if (!samples.length) return 0;
  if (samples.length < HOLD_WINDOW) return Math.max(0, Math.min(...samples));
  let best = 0;
  for (let i = HOLD_WINDOW - 1; i < samples.length; i++) {
    let lo = Infinity;
    for (let j = i - HOLD_WINDOW + 1; j <= i; j++) lo = Math.min(lo, samples[j]);
    best = Math.max(best, lo);
  }
  return Math.max(0, best);
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// days: [{ date: 'YYYY-MM-DD', clean: boolean }] (one row per logged day)
function consistencyStats(days, today) {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : 1));
  let bestStreak = 0;
  let run = 0;
  let prev = null;
  let cleanDays = 0;
  for (const d of sorted) {
    if (d.clean) {
      cleanDays++;
      run = prev && prev.clean && addDays(prev.date, 1) === d.date ? run + 1 : 1;
      bestStreak = Math.max(bestStreak, run);
    } else {
      run = 0;
    }
    prev = d;
  }
  const cleanSet = new Set(sorted.filter(d => d.clean).map(d => d.date));
  let streak = 0;
  for (let cur = today; cleanSet.has(cur); cur = addDays(cur, -1)) streak++;
  const weekStart = addDays(today, -6);
  const recent = sorted.filter(d => d.date >= weekStart && d.date <= today);
  return {
    loggedDays: sorted.length,
    cleanDays,
    bestStreak,
    streak,
    logged7: recent.length,
    clean7: recent.filter(d => d.clean).length,
  };
}

function healthFrom({ logged7, clean7, accountAgeDays }) {
  // Brand-new accounts start healthy rather than "dormant" on day one.
  if (accountAgeDays < 2 && logged7 === 0) return 0.85;
  const window = Math.max(1, Math.min(7, Math.ceil(accountAgeDays)));
  const logRatio = Math.min(1, logged7 / window);
  const cleanRatio = logged7 ? clean7 / logged7 : 0;
  return clamp01(HEALTH_FLOOR + (1 - HEALTH_FLOOR) * logRatio * (0.55 + 0.45 * cleanRatio));
}

function legacyStage(savings) {
  const s = Number(savings) || 0;
  return s < 50 ? 1 : s < 150 ? 2 : s < 500 ? 3 : s < 1500 ? 4 : 5;
}

function legacyFloor(species, savings) {
  const row = LEGACY_FLOORS[species] || LEGACY_FLOORS.oak;
  return row[legacyStage(savings) - 1];
}

function maturityFor(growth) {
  let cur = MATURITY[0];
  for (const m of MATURITY) if (growth >= m.at) cur = m;
  const next = MATURITY.find(m => m.at > growth) || null;
  return { key: cur.key, name: cur.name, next: next ? { key: next.key, name: next.name, at: next.at } : null };
}

function seedBase(userId) {
  return parseInt(crypto.createHash('sha256').update(`vt-tree:${userId}`).digest('hex').slice(0, 8), 16);
}

// prev: stored state (companion_state._growth) or null for a tree that has
// never been through this model. Returns { state, changed }.
function ratchet(prev, target, nowMs, floor) {
  const nowIso = new Date(nowMs).toISOString();
  if (!prev || !Number.isFinite(prev.g)) {
    const g = clamp01(floor);
    return { state: { v: 1, g, at: nowIso, peakAt: null, reached: {}, celebrated: [] }, changed: true, initialized: true };
  }
  const lastMs = Date.parse(prev.at) || nowMs;
  const elapsedDays = Math.max(0, Math.min(MAX_CREDIT_DAYS, (nowMs - lastMs) / DAY_MS));
  const allowed = prev.g + MAX_DAILY_GAIN * elapsedDays;
  const g = clamp01(Math.max(prev.g, Math.min(target, allowed)));
  const rose = g > prev.g + 1e-6;
  const stale = nowMs - lastMs > 3600000;
  return {
    state: { ...prev, g: round4(g), at: rose || stale ? nowIso : prev.at, peakAt: rose ? nowIso : prev.peakAt || null },
    changed: rose || stale,
    initialized: false,
  };
}

function round4(v) { return Math.round(v * 10000) / 10000; }

function monthsBetween(fromIso, nowMs) {
  if (!fromIso) return 0;
  const from = Date.parse(fromIso);
  if (!Number.isFinite(from)) return 0;
  return Math.max(0, Math.floor((nowMs - from) / (DAY_MS * 30.44)));
}

// Full evaluation. inputs:
//   species, savingsSeries (number[] oldest->newest), currentSavings,
//   debtPaid, days ([{date, clean}]), today ('YYYY-MM-DD'),
//   accountCreatedAt, firstEntryDate, legacySavings, stored (prior _growth)
function evaluateTree(inputs, nowMs = Date.now()) {
  const stats = consistencyStats(inputs.days || [], inputs.today);
  const moneyMoved = round2(heldSavings(inputs.savingsSeries, inputs.currentSavings) + Math.max(0, Number(inputs.debtPaid) || 0));
  const target = growthTarget({ moneyMoved, loggedDays: stats.loggedDays, bestStreak: stats.bestStreak });
  // A tree with no stored state predates this model: start it at the floor
  // matching the stage art it had. New companions are initialised at 0 by
  // PUT /api/companion, so they never take this path.
  const floor = inputs.stored ? 0 : legacyFloor(inputs.species, inputs.legacySavings);
  const { state, changed, initialized } = ratchet(inputs.stored, target, nowMs, floor);

  const accountAgeDays = inputs.accountCreatedAt ? (nowMs - Date.parse(inputs.accountCreatedAt)) / DAY_MS : 30;
  const health = round2(healthFrom({ ...stats, accountAgeDays }));
  const since = [inputs.firstEntryDate, inputs.accountCreatedAt].filter(Boolean).sort()[0];
  const monthsActive = monthsBetween(since, nowMs);

  const snapshot = { growth: state.g, bestStreak: stats.bestStreak, moneyMoved, monthsActive };
  const reached = { ...(state.reached || {}) };
  let reachedChanged = false;
  const nowIso = new Date(nowMs).toISOString();
  for (const m of MILESTONES) {
    if (!reached[m.key] && m.test(snapshot)) {
      reached[m.key] = nowIso;
      reachedChanged = true;
    }
  }
  let celebrated = (state.celebrated || []).filter(k => MILESTONE_KEYS.has(k));
  // First time through the new model: everything already earned counts as
  // celebrated, so existing users don't get a burst of animations on deploy.
  if (initialized) celebrated = Object.keys(reached);
  const nextState = { ...state, reached, celebrated };

  const blossom = reached.full_bloom ? 1 : reached.first_bloom ? 0.55 : 0;
  const fruit = reached.harvest ? 1 : reached.first_fruit ? 0.5 : 0;
  const newGrowth = !!state.peakAt && nowMs - Date.parse(state.peakAt) < NEW_GROWTH_DAYS * DAY_MS;
  const pending = MILESTONES.filter(m => reached[m.key] && !celebrated.includes(m.key)).map(m => ({ key: m.key, text: m.text }));
  const timeline = MILESTONES.filter(m => reached[m.key])
    .map(m => ({ key: m.key, text: m.text, at: reached[m.key] }))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  return {
    state: nextState,
    changed: changed || reachedChanged || initialized,
    view: {
      growth: state.g,
      target: round4(target),
      health,
      maturity: maturityFor(state.g),
      features: { blossom, fruit, newGrowth },
      monthsActive,
      moneyMoved,
      loggedDays: stats.loggedDays,
      bestStreak: stats.bestStreak,
      pendingCelebrations: pending,
      timeline,
      nextMilestone: nextMilestone(reached, stats, moneyMoved),
    },
    stats,
  };
}

function nextMilestone(reached, stats, moneyMoved) {
  if (!reached.first_bloom) return { key: 'first_bloom', text: `First blossoms at a 7-day clean streak (best so far: ${stats.bestStreak})` };
  if (!reached.first_fruit) return { key: 'first_fruit', text: `First fruit at $500 moved ($${Math.round(moneyMoved)} so far)` };
  if (!reached.full_bloom) return { key: 'full_bloom', text: `Full bloom at a 30-day clean streak (best so far: ${stats.bestStreak})` };
  if (!reached.harvest) return { key: 'harvest', text: `Full harvest at $2,500 moved ($${Math.round(moneyMoved)} so far)` };
  return null;
}

function round2(v) { return Math.round(v * 100) / 100; }

function markCelebrated(stored, keys) {
  if (!stored) return stored;
  const valid = (keys || []).filter(k => MILESTONE_KEYS.has(k) && stored.reached && stored.reached[k]);
  const celebrated = Array.from(new Set([...(stored.celebrated || []), ...valid]));
  return { ...stored, celebrated };
}

module.exports = {
  MAX_DAILY_GAIN,
  MAX_CREDIT_DAYS,
  MILESTONES,
  growthTarget,
  moneyScore,
  consistencyScore,
  heldSavings,
  consistencyStats,
  healthFrom,
  legacyStage,
  legacyFloor,
  maturityFor,
  seedBase,
  ratchet,
  evaluateTree,
  markCelebrated,
};
