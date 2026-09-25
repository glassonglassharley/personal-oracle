// All period boundaries are evaluated on the America/Los_Angeles calendar, the
// same zone the daily snapshot writer keys rows on, so tiles never drift with
// the viewer's browser timezone.
const REPORTING_TIME_ZONE = 'America/Los_Angeles';
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function dateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function zonedDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: REPORTING_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

function periodStarts(now) {
  const { year, month, day } = zonedDateParts(now);
  // Calendar math runs in UTC over the Pacific calendar date, so shifting by
  // whole days can never cross a DST boundary.
  const today = new Date(Date.UTC(year, month - 1, day));
  const week = new Date(today);
  const daysSinceMonday = (today.getUTCDay() + 6) % 7;
  week.setUTCDate(week.getUTCDate() - daysSinceMonday);

  return {
    today: dateKey(year, month, day),
    week: dateKey(week.getUTCFullYear(), week.getUTCMonth() + 1, week.getUTCDate()),
    month: dateKey(year, month, 1),
    year: dateKey(year, 1, 1),
  };
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Only real daily snapshots carry a snapshot_date. Legacy pre-cron rows have a
// null snapshot_date and are readable for charts, but must never anchor a tile.
function snapshotDateKey(snapshot) {
  if (!snapshot?.snapshot_date) return null;
  const key = String(snapshot.snapshot_date).slice(0, 10);
  return DATE_KEY_PATTERN.test(key) ? key : null;
}

function normalizedSnapshotHistory(history) {
  return history
    .map(snapshot => ({ balance: Number(snapshot.balance), key: snapshotDateKey(snapshot) }))
    .filter(snapshot => snapshot.key !== null
      && Number.isFinite(snapshot.balance));
}

function periodBaseline(history, startKey, todayKey) {
  const beforeOrAtStart = normalizedSnapshotHistory(history)
    .filter(snapshot => snapshot.key <= startKey)
    .sort((a, b) => b.key.localeCompare(a.key))[0];
  if (beforeOrAtStart) return { ...beforeOrAtStart, spendStartKey: startKey };

  // If tracking began after the calendar period started, use the first real
  // snapshot inside the period instead of hiding the card forever. The saved
  // amount and the vice-spend comparison both start from that snapshot date, so
  // week/month/year tiles remain honest when history only begins mid-period.
  const firstInsidePeriod = normalizedSnapshotHistory(history)
    .filter(snapshot => snapshot.key >= startKey && snapshot.key <= todayKey)
    .sort((a, b) => a.key.localeCompare(b.key))[0];
  return firstInsidePeriod ? { ...firstInsidePeriod, spendStartKey: firstInsidePeriod.key } : null;
}

// Earliest real snapshot on record — the point the tiles can actually measure
// from. Returns null until the daily writer has produced its first row.
export function findTrackingStartDate(history = []) {
  return history.reduce((earliest, snapshot) => {
    const key = snapshotDateKey(snapshot);
    if (key === null || !Number.isFinite(Number(snapshot.balance))) return earliest;
    return earliest === null || key < earliest ? key : earliest;
  }, null);
}

export function buildSavingsPeriodSummary({ now = new Date(), currentBalance, history = [], spendDays = [] }) {
  const current = Number(currentBalance);
  const starts = periodStarts(now);
  const todayKey = starts.today;

  return Object.fromEntries(Object.entries(starts).map(([key, startKey]) => {
    const baseline = periodBaseline(history, startKey, todayKey);
    const spendStartKey = baseline?.spendStartKey || startKey;
    const spent = roundCurrency(spendDays.reduce((total, day) => {
      const date = String(day.date || '').slice(0, 10);
      const amount = Number(day.spend);
      return date >= spendStartKey && date <= todayKey && Number.isFinite(amount) ? total + amount : total;
    }, 0));
    const hasBaseline = baseline !== null && Number.isFinite(current);
    const saved = hasBaseline ? roundCurrency(current - baseline.balance) : null;

    return [key, {
      saved,
      spent,
      net: hasBaseline ? roundCurrency(saved - spent) : null,
      hasBaseline,
    }];
  }));
}
