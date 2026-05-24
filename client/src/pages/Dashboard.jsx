import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend
} from 'chart.js';
import { useApi } from '../useApi';
import { useViceContext } from '../ViceContext';
import { formatQuantityWithUnit } from '../formatUnits';
import { GoalsSection, CelebOverlay } from './GoalsSection';
import CompanionCard from '../companions/CompanionCard';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const fmt$ = n => '$' + Number(n || 0).toFixed(2);

function last7Dates() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
}

function emptyPeriod() {
  return { quantity: 0, spend: 0, byVice: [] };
}

function combinePeriod(vices, statsByVice, key) {
  const byVice = vices.map(vice => ({
    vice,
    quantity: Number(statsByVice[vice.id]?.[key]?.quantity || 0),
    spend: Number(statsByVice[vice.id]?.[key]?.spend || 0),
  }));

  return {
    quantity: byVice.reduce((sum, item) => sum + item.quantity, 0),
    spend: byVice.reduce((sum, item) => sum + item.spend, 0),
    byVice,
  };
}

function combineStats(vices, statsByVice) {
  if (vices.length === 0) return null;

  const totals = vices.reduce((acc, vice) => {
    const s = statsByVice[vice.id];
    if (!s) return acc;

    const activeDays = Number(s.total_logged_days || 0);
    const cleanDays = Number(s.clean_days || 0);
    const totalDays = activeDays + cleanDays;
    const avgDailySpend = Number(s.avg_daily_spend || 0);
    const avgQuantityPerDay = Number(s.avg_quantity_per_day || 0);
    const estimatedSpend = avgDailySpend * totalDays;

    acc.totalDays += totalDays;
    acc.totalLoggedDays += activeDays;
    acc.cleanDays += cleanDays;
    acc.savingsFromCleanDays += Number(s.savings_from_clean_days || 0);
    acc.estimatedSpend += estimatedSpend;
    acc.quantityByVice.push({ vice, avgQuantityPerDay, totalDays });
    return acc;
  }, {
    totalDays: 0,
    totalLoggedDays: 0,
    cleanDays: 0,
    savingsFromCleanDays: 0,
    estimatedSpend: 0,
    quantityByVice: [],
  });

  return {
    today: combinePeriod(vices, statsByVice, 'today'),
    week: combinePeriod(vices, statsByVice, 'week'),
    month: combinePeriod(vices, statsByVice, 'month'),
    year: combinePeriod(vices, statsByVice, 'year'),
    avg_daily_spend: totals.totalDays > 0 ? totals.estimatedSpend / totals.totalDays : 0,
    total_logged_days: totals.totalLoggedDays,
    clean_days: totals.cleanDays,
    savings_from_clean_days: totals.savingsFromCleanDays,
    quantityByVice: totals.quantityByVice,
  };
}

function QuantityBreakdown({ period }) {
  const items = period.byVice.filter(item => item.quantity > 0);
  if (items.length === 0) return <span>0 across all vices</span>;

  return (
    <span>
      {items.map(({ vice, quantity }) => formatQuantityWithUnit(quantity, vice)).join(' · ')}
    </span>
  );
}

export default function Dashboard() {
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;

  const { vices, companion, setShowOnboarding } = useViceContext();
  const [stats, setStats] = useState(null);
  const [last7, setLast7] = useState([]);
  const [recentEntries, setRecentEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  // Goals state
  const [goals, setGoals] = useState([]);
  const [celebGoal, setCelebGoal] = useState(null);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalAmt, setGoalAmt] = useState('');
  const celebratedRef = useRef(new Set());

  // Challenge notifications
  const [challenges, setChallenges] = useState([]);

  const moneyColor = typeof document !== 'undefined'
    ? (getComputedStyle(document.body).getPropertyValue('--money').trim() || '#5ec48a')
    : '#5ec48a';
  const inkColor = typeof document !== 'undefined'
    ? (getComputedStyle(document.body).getPropertyValue('--ink-3').trim() || '#8e9a85')
    : '#8e9a85';

  // Load goals + challenges once on mount
  useEffect(() => {
    apiRef.current('/api/goals').then(setGoals).catch(() => {});
    apiRef.current('/api/partners/challenges').then(setChallenges).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Celebrate when a goal is first reached
  useEffect(() => {
    if (!stats) return;
    const savings = stats.savings_from_clean_days;
    goals.filter(g => !g.completed_at).forEach(g => {
      if (savings >= Number(g.target_amount) && !celebratedRef.current.has(g.id)) {
        celebratedRef.current.add(g.id);
        setCelebGoal(g);
      }
    });
  }, [stats, goals]);

  const createGoal = async (e) => {
    e.preventDefault();
    try {
      const g = await apiRef.current('/api/goals', {
        method: 'POST',
        body: JSON.stringify({ title: goalTitle, target_amount: goalAmt }),
      });
      setGoals(gs => [g, ...gs]);
      setGoalTitle(''); setGoalAmt(''); setShowGoalForm(false);
    } catch {}
  };

  const markGoalDone = async (id) => {
    try {
      await apiRef.current(`/api/goals/${id}/complete`, { method: 'PUT' });
      setGoals(gs => gs.map(g => g.id === id ? { ...g, completed_at: new Date().toISOString() } : g));
      setCelebGoal(null);
    } catch {}
  };

  const deleteGoal = async (id) => {
    try {
      await apiRef.current(`/api/goals/${id}`, { method: 'DELETE' });
      setGoals(gs => gs.filter(g => g.id !== id));
    } catch {}
  };

  useEffect(() => {
    if (vices.length === 0) {
      setStats(null);
      setLast7([]);
      setRecentEntries([]);
      return;
    }

    setLoading(true);
    const dates = last7Dates();
    const from = dates[0], to = dates[6];

    Promise.all(vices.map(async vice => {
      const [statsForVice, weekEntries, allEntries] = await Promise.all([
        apiRef.current(`/api/stats/${vice.id}`),
        apiRef.current(`/api/entries?vice_id=${vice.id}&from=${from}&to=${to}`),
        apiRef.current(`/api/entries?vice_id=${vice.id}`),
      ]);
      return { vice, statsForVice, weekEntries, allEntries };
    })).then(results => {
      const statsByVice = {};
      const spendByDate = Object.fromEntries(dates.map(date => [date, 0]));
      const allEntries = [];

      results.forEach(({ vice, statsForVice, weekEntries, allEntries: entries }) => {
        statsByVice[vice.id] = statsForVice;
        weekEntries.forEach(entry => {
          const date = entry.date.split('T')[0];
          spendByDate[date] = (spendByDate[date] || 0) + Number(entry.quantity || 0) * Number(entry.price_per_unit || 0);
        });
        entries.forEach(entry => allEntries.push({ ...entry, vice }));
      });

      setStats(combineStats(vices, statsByVice));
      setLast7(dates.map(date => ({ date, spend: spendByDate[date] || 0 })));
      setRecentEntries(allEntries
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10));
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [vices]); // eslint-disable-line react-hooks/exhaustive-deps

  const chartData = {
    labels: last7.map(({ date }) => {
      const d = new Date(date + 'T00:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
    }),
    datasets: [{
      label: 'Combined spend',
      data: last7.map(({ spend }) => Number(spend || 0)),
      backgroundColor: last7.map(({ spend }) => Number(spend || 0) === 0 ? moneyColor : inkColor),
      borderRadius: 4,
    }]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: context => ` Combined spend: ${fmt$(context.parsed.y)}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(128,128,128,0.08)' },
        ticks: { color: inkColor, callback: value => fmt$(value) },
      },
      x: { grid: { display: false }, ticks: { color: inkColor } },
    }
  };

  if (vices.length === 0) {
    return (
      <main className="main">
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h2>No vices tracked yet</h2>
          <p>Go to <a href="/vices">Vices</a> to add your first one.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="main">
      <div className="crumbs">
        <span>Vice Spending</span>
        <span className="sep">›</span>
        <span className="here">Combined Dashboard</span>
        <span className="crumb-pill">
          <span className="dot" />
          All vices
        </span>
      </div>

      <div className="dashboard-head">
        <div>
          <div className="page-title">Dashboard</div>
          <p className="page-subtitle">Combined overview across every tracked vice.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link className="btn dashboard-log-btn" to="/log">
            <span>＋</span>
            Log Entry
          </Link>
        </div>
      </div>

      {challenges.map(c => (
        <div key={c.id} className="challenge-banner">
          <span className="challenge-icon">⚔️</span>
          <span className="challenge-text">
            <strong>{c.challenger_name}</strong> challenged you to a clean month!
          </span>
          <a className="btn ghost" style={{ fontSize: 12, padding: '6px 12px' }} href="/partners">View leaderboard</a>
        </div>
      ))}

      {celebGoal && (
        <CelebOverlay
          goal={celebGoal}
          onComplete={() => markGoalDone(celebGoal.id)}
          onDismiss={() => setCelebGoal(null)}
        />
      )}

      {companion?.companion_type && (
        <CompanionCard
          companion={companion}
          growth={companion?.growth}
          onEditCompanion={() => setShowOnboarding(true)}
        />
      )}

      {loading ? <div className="loading">Loading…</div> : stats && (
        <>
          <div className="stats-strip">
            {[
              { key: 'Today', p: stats.today || emptyPeriod() },
              { key: 'This week', p: stats.week || emptyPeriod() },
              { key: 'This month', p: stats.month || emptyPeriod() },
              { key: 'This year', p: stats.year || emptyPeriod() },
            ].map(({ key, p }) => (
              <div key={key} className="stat">
                <div className="stat-key">{key}</div>
                <div className="stat-val">
                  {'$' + Number(p.spend || 0).toFixed(0)}
                  <span className="small">.{Number(p.spend || 0).toFixed(2).split('.')[1]}</span>
                </div>
                <div className="stat-delta"><QuantityBreakdown period={p} /></div>
              </div>
            ))}
          </div>

          <GoalsSection
            goals={goals}
            savings={stats.savings_from_clean_days}
            avgDailySpend={stats.avg_daily_spend}
            showForm={showGoalForm}
            setShowForm={setShowGoalForm}
            goalTitle={goalTitle}
            setGoalTitle={setGoalTitle}
            goalAmt={goalAmt}
            setGoalAmt={setGoalAmt}
            onCreateGoal={createGoal}
            onDeleteGoal={deleteGoal}
          />

          <div className="grid-2">
            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">Combined savings summary</span>
              </div>
              <div className="savings-rows">
                <div className="savings-row"><span>Clean days logged</span><strong className="text-money">{stats.clean_days} days</strong></div>
                <div className="savings-row"><span>Saved from clean days</span><strong className="text-money">{fmt$(stats.savings_from_clean_days)}</strong></div>
                <div className="savings-row"><span>Avg daily spend</span><strong>{fmt$(stats.avg_daily_spend)}</strong></div>
                <div className="savings-divider" />
                <div className="savings-row"><span>Quit all · 30 days</span><strong className="text-money">{fmt$(stats.avg_daily_spend * 30)}</strong></div>
                <div className="savings-row"><span>Quit all · 90 days</span><strong className="text-money">{fmt$(stats.avg_daily_spend * 90)}</strong></div>
                <div className="savings-row"><span>Quit all · 1 year</span><strong className="text-money">{fmt$(stats.avg_daily_spend * 365)}</strong></div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">Last 7 days · combined spend</span>
              </div>
              <div className="dashboard-chart-wrap">
                <Bar data={chartData} options={{ ...chartOptions, maintainAspectRatio: false }} />
              </div>
            </div>
          </div>

          <div className="grid-2">
            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">Per-vice averages</span>
              </div>
              <div className="savings-rows">
                {stats.quantityByVice.map(({ vice, avgQuantityPerDay }) => (
                  <div className="savings-row" key={vice.id}>
                    <span>{vice.emoji} {vice.name}/day</span>
                    <strong>{formatQuantityWithUnit(avgQuantityPerDay, vice)}</strong>
                  </div>
                ))}
                <div className="savings-divider" />
                <div className="savings-row"><span>Total clean days</span><strong className="text-money">{stats.clean_days}</strong></div>
                <div className="savings-row"><span>Active days logged</span><strong>{stats.total_logged_days}</strong></div>
                <p className="text-muted" style={{ margin: 0 }}>Detailed metrics for each vice live under the Vices tab.</p>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">Recent entries · all vices</span>
              </div>
              {recentEntries.length === 0 ? (
                <p className="text-muted">No entries yet — go to Log to add one.</p>
              ) : (
                <div className="entry-list">
                  {recentEntries.map(e => {
                    const isClean = Number(e.quantity) === 0;
                    const d = new Date((e.date + '').split('T')[0] + 'T00:00:00');
                    return (
                      <div key={`${e.vice.id}-${e.id}`} className={`entry-item ${isClean ? 'clean' : ''}`}>
                        <span className="entry-date">
                          {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        {isClean ? (
                          <>
                            <span className="text-money entry-label">{e.vice.emoji} {e.vice.name} · Clean day</span>
                            <span className="text-money entry-saved">saved {fmt$(stats.avg_daily_spend)}</span>
                          </>
                        ) : (
                          <>
                            <span className="entry-qty">{e.vice.emoji} {formatQuantityWithUnit(e.quantity, e.vice)}</span>
                            <span className="entry-spend">{fmt$(e.quantity * e.price_per_unit)}</span>
                          </>
                        )}
                        <Link
                          className="entry-edit-btn"
                          to="/log"
                          state={{ editEntry: { ...e, vice_id: e.vice_id || e.vice.id } }}
                        >
                          Edit
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!loading && !stats && vices.length > 0 && (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h2>No entries yet</h2>
          <p>Start logging on the <a href="/log">Log</a> page.</p>
        </div>
      )}
    </main>
  );
}
