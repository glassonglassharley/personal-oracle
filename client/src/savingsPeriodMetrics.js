function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function periodStarts(now) {
  const today = startOfDay(now);
  const week = new Date(today);
  const daysSinceMonday = (today.getDay() + 6) % 7;
  week.setDate(week.getDate() - daysSinceMonday);

  return {
    today,
    week,
    month: new Date(now.getFullYear(), now.getMonth(), 1),
    year: new Date(now.getFullYear(), 0, 1),
  };
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function balanceAtOrBefore(history, boundary) {
  const eligible = history
    .map(snapshot => ({
      balance: Number(snapshot.balance),
      recordedAt: snapshot.snapshot_date
        ? new Date(`${String(snapshot.snapshot_date).slice(0, 10)}T00:00:00`)
        : new Date(snapshot.recorded_at),
    }))
    .filter(snapshot => Number.isFinite(snapshot.balance)
      && !Number.isNaN(snapshot.recordedAt.getTime())
      && snapshot.recordedAt <= boundary)
    .sort((a, b) => b.recordedAt - a.recordedAt);

  return eligible[0]?.balance ?? null;
}

export function buildSavingsPeriodSummary({ now = new Date(), currentBalance, history = [], spendDays = [] }) {
  const current = Number(currentBalance);
  const starts = periodStarts(now);
  const todayKey = localDateKey(now);

  return Object.fromEntries(Object.entries(starts).map(([key, start]) => {
    const startKey = localDateKey(start);
    const baseline = balanceAtOrBefore(history, start);
    const spent = roundCurrency(spendDays.reduce((total, day) => {
      const date = String(day.date || '').slice(0, 10);
      const amount = Number(day.spend);
      return date >= startKey && date <= todayKey && Number.isFinite(amount) ? total + amount : total;
    }, 0));
    const hasBaseline = baseline !== null && Number.isFinite(current);
    const saved = hasBaseline ? roundCurrency(current - baseline) : null;

    return [key, {
      saved,
      spent,
      net: hasBaseline ? roundCurrency(saved - spent) : null,
      hasBaseline,
    }];
  }));
}