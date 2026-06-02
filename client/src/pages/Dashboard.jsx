import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';

function Confetti() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    const COLORS = ['#0F6E56', '#5ec48a', '#ffd700', '#ff9f43', '#74c0fc', '#ffffff'];
    const pieces = Array.from({ length: 130 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height * 0.6,
      vx: (Math.random() - 0.5) * 7,
      vy: Math.random() * 5 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      w: Math.random() * 12 + 4,
      h: Math.random() * 7 + 3,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.25,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.13; p.angle += p.spin;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <canvas
      ref={ref}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}

function LevelUpOverlay({ data, onDismiss }) {
  return (
    <div className="celeb-overlay" onClick={onDismiss} style={{ zIndex: 300 }}>
      <Confetti />
      <div className="celeb-card" onClick={e => e.stopPropagation()}>
        <div className="celeb-check" style={{ fontSize: 36 }}>{data.level_icon}</div>
        <div className="celeb-kicker">Level Up!</div>
        <div className="celeb-title">{data.level_name}</div>
        <div className="celeb-amount" style={{ fontSize: 'clamp(32px,10vw,52px)' }}>
          Level {data.level}
        </div>
        <div className="celeb-sub">
          {data.total_xp.toLocaleString()} XP total
          {data.next_level_name ? ` · Next: ${data.next_level_name} ${data.next_level_icon}` : ''}
        </div>
        <div className="celeb-actions">
          <button className="btn" onClick={onDismiss}>Keep going</button>
        </div>
      </div>
    </div>
  );
}
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend
} from 'chart.js';
import { useApi } from '../useApi';
import { useViceContext } from '../ViceContext';
import { formatQuantityWithUnit } from '../formatUnits';
import { GoalsSection, CelebOverlay } from './GoalsSection';
import { BadgeCelebOverlay } from './BadgeCelebOverlay';
import CompanionCard from '../companions/CompanionCard';
import BadgesSection from './BadgesSection';
import InsightsPanel from '../components/InsightsPanel';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const fmt$ = n => '$' + Number(n || 0).toFixed(2);

function last7Dates() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  const [y, m, d] = todayStr.split('-').map(Number);
  const pad = n => String(n).padStart(2, '0');
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.UTC(y, m - 1, d - (6 - i)));
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
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

  const streakByVice = vices.map(v => ({
    vice: v,
    current: Number(statsByVice[v.id]?.current_streak || 0),
    best:    Number(statsByVice[v.id]?.best_streak    || 0),
  }));

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
    // Combined streak = min across all vices (clean everywhere or it doesn't count)
    current_streak: streakByVice.length ? Math.min(...streakByVice.map(s => s.current)) : 0,
    best_streak:    streakByVice.length ? Math.max(...streakByVice.map(s => s.best))    : 0,
    streakByVice,
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

  const { vices, companion, setShowOnboarding, viceFetchError, loadVices } = useViceContext();
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
  const [goalError, setGoalError] = useState('');
  const celebratedRef = useRef(new Set());

  // Challenge notifications
  const [challenges, setChallenges] = useState([]);
  const [newBadges, setNewBadges] = useState([]);

  // XP + levels
  const [xpData, setXpData] = useState(null);
  const [levelUpMsg, setLevelUpMsg] = useState('');
  const [levelUpOverlay, setLevelUpOverlay] = useState(null);

  // Weekly AI insight
  const [weeklyInsight, setWeeklyInsight] = useState(null);

  const moneyColor = typeof document !== 'undefined'
    ? (getComputedStyle(document.body).getPropertyValue('--money').trim() || '#5ec48a')
    : '#5ec48a';
  const inkColor = typeof document !== 'undefined'
    ? (getComputedStyle(document.body).getPropertyValue('--ink-3').trim() || '#8e9a85')
    : '#8e9a85';

  // Load goals + challenges + badge check + XP + weekly insight once on mount
  useEffect(() => {
    apiRef.current('/api/goals').then(setGoals).catch(() => {});
    apiRef.current('/api/partners/challenges').then(setChallenges).catch(() => {});
    apiRef.current('/api/badges/check', { method: 'POST' })
      .then(({ newly_earned }) => { if (newly_earned?.length) setNewBadges(newly_earned); })
      .catch(() => {});
    apiRef.current('/api/xp').then(data => {
      setXpData(data);
      try {
        const storedLevel = parseInt(localStorage.getItem('vt-last-level') || '0', 10);
        if (storedLevel > 0 && data.level > storedLevel) {
          setLevelUpOverlay(data);
          setLevelUpMsg(`Level up! You're now a ${data.level_name} ${data.level_icon}`);
          setTimeout(() => setLevelUpMsg(''), 5000);
        }
        localStorage.setItem('vt-last-level', String(data.level));
      } catch {}
    }).catch(() => {});
    apiRef.current('/api/insights/weekly', { method: 'POST' })
      .then(d => { if (d.insight) setWeeklyInsight(d.insight); })
      .catch(() => {});
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
    setGoalError('');
    try {
      const g = await apiRef.current('/api/goals', {
        method: 'POST',
        body: JSON.stringify({ title: goalTitle, target_amount: goalAmt }),
      });
      setGoals(gs => [g, ...gs]);
      setGoalTitle(''); setGoalAmt(''); setShowGoalForm(false);
    } catch (err) {
      setGoalError(err.message || 'Could not create goal.');
    }
  };

  const markGoalDone = async (id) => {
    try {
      await apiRef.current(`/api/goals/${id}/complete`, { method: 'PUT' });
      setGoals(gs => gs.map(g => g.id === id ? { ...g, completed_at: new Date().toISOString() } : g));
      setCelebGoal(null);
    } catch (err) {
      console.error('markGoalDone failed:', err);
    }
  };

  const deleteGoal = async (id) => {
    try {
      await apiRef.current(`/api/goals/${id}`, { method: 'DELETE' });
      setGoals(gs => gs.filter(g => g.id !== id));
    } catch (err) {
      console.error('deleteGoal failed:', err);
    }
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
        apiRef.current(`/api/stats/${vice.id}?tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`),
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

  const isMobileView = typeof window !== 'undefined' && window.innerWidth <= 520;

  const chartData = {
    labels: last7.map(({ date }) => {
      const d = new Date(date + 'T00:00:00');
      return isMobileView
        ? d.toLocaleDateString('en-US', { weekday: 'short' })
        : d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
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
      x: { grid: { display: false }, ticks: { color: inkColor, maxRotation: 0, font: { size: isMobileView ? 9 : 11 } } },
    }
  };

  if (viceFetchError) {
    return (
      <main className="main">
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <h2>Could not load your data</h2>
          <p>There was a problem connecting to the server. Check your connection and try again.</p>
          <button className="btn" style={{ marginTop: 16 }} onClick={loadVices}>Retry</button>
        </div>
      </main>
    );
  }

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
        <div className="db-head-actions">
          <Link className="btn ghost btn-sm" to="/savings" style={{ textDecoration: 'none' }}>
            View Savings
          </Link>
          <Link className="btn dashboard-log-btn" to="/log" style={{ textDecoration: 'none' }}>
            <span>＋</span>
            Log Today
          </Link>
        </div>
      </div>

      {weeklyInsight && (
        <div className="insight-card insight-card-top">
          <div className="insight-card-head">
            <span className="insight-sparkle">✨</span>
            <span className="insight-title">Weekly insight</span>
          </div>
          <p className="insight-body">{weeklyInsight}</p>
        </div>
      )}

      {challenges.map(c => (
        <div key={c.id} className="challenge-banner">
          <span className="challenge-icon">⚔️</span>
          <span className="challenge-text">
            <strong>{c.challenger_name}</strong> challenged you to a clean month!
          </span>
          <Link className="btn btn-sm" to="/partners" style={{ textDecoration: 'none' }}>View challenge</Link>
        </div>
      ))}

      {celebGoal && (
        <CelebOverlay
          goal={celebGoal}
          onComplete={() => markGoalDone(celebGoal.id)}
          onDismiss={() => setCelebGoal(null)}
        />
      )}

      {newBadges.length > 0 && (
        <BadgeCelebOverlay badges={newBadges} onDismiss={() => setNewBadges([])} />
      )}

      {levelUpOverlay && (
        <LevelUpOverlay data={levelUpOverlay} onDismiss={() => setLevelUpOverlay(null)} />
      )}

      {companion?.companion_type && (
        <CompanionCard
          companion={companion}
          growth={companion?.growth}
          onEditCompanion={() => setShowOnboarding(true)}
        />
      )}

      {loading ? (
        <div className="db-skeleton">
          <div className="stats-strip">
            {[0,1,2,3].map(i => (
              <div key={i} className="stat">
                <div className="skeleton skeleton-text" style={{ width: '55%', marginBottom: 10 }} />
                <div className="skeleton skeleton-stat" style={{ width: '75%' }} />
                <div className="skeleton skeleton-text" style={{ width: '90%', marginTop: 8 }} />
              </div>
            ))}
          </div>
          <div className="grid-2" style={{ marginTop: 24 }}>
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-chart" />
          </div>
        </div>
      ) : stats && (
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

          <Link className="btn btn-lg mobile-log-cta" to="/log" style={{ textDecoration: 'none' }}>
            <span>＋</span> Log Entry
          </Link>

          {(stats.current_streak > 0 || stats.best_streak > 0) && (
            <div className="streak-card">
              <div className="streak-main">
                <div className="streak-flame">{stats.current_streak > 0 ? '🔥' : '💤'}</div>
                <div>
                  <div className="streak-num">{stats.current_streak}</div>
                  <div className="streak-label">day streak</div>
                </div>
                {stats.best_streak > 0 && (
                  <div className="streak-best">
                    <div className="streak-best-num">{stats.best_streak}</div>
                    <div className="streak-best-label">best</div>
                  </div>
                )}
              </div>
              {stats.streakByVice.length > 1 && (
                <div className="streak-by-vice">
                  {stats.streakByVice.map(({ vice, current }) => (
                    <span key={vice.id} className="streak-vice-pill">
                      {vice.emoji} {current}d
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {xpData && (
            <div className="xp-card">
              {levelUpMsg && <div className="xp-levelup-toast">{levelUpMsg}</div>}
              <div className="xp-card-top">
                <div className="xp-level-icon">{xpData.level_icon}</div>
                <div>
                  <div className="xp-level-name">{xpData.level_name}</div>
                  <div className="xp-level-num">Level {xpData.level}</div>
                </div>
                <div className="xp-total">{xpData.total_xp.toLocaleString()} XP</div>
              </div>
              <div className="xp-bar-track">
                <div className="xp-bar-fill" style={{ width: `${xpData.progress_percent}%` }} />
              </div>
              <div className="xp-bar-foot">
                <span>{xpData.total_xp} / {xpData.total_xp + xpData.xp_to_next_level} XP</span>
                {xpData.next_level_name && (
                  <span>Next: {xpData.next_level_name} {xpData.next_level_icon}</span>
                )}
              </div>
            </div>
          )}

          <InsightsPanel />

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
            goalError={goalError}
            onCreateGoal={createGoal}
            onDeleteGoal={deleteGoal}
          />

          <BadgesSection />

          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Last 7 days · combined spend</span>
            </div>
            <div className="dashboard-chart-wrap">
              <Bar data={chartData} options={{ ...chartOptions, maintainAspectRatio: false }} />
            </div>
          </div>

          <div className="grid-2">
            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">Per-vice breakdown</span>
              </div>
              <div className="savings-rows">
                {(() => {
                  const totalSpend = stats.year?.byVice?.reduce((sum, v) => sum + v.spend, 0) || 0;
                  return stats.quantityByVice.map(({ vice, avgQuantityPerDay }) => {
                    const viceSpend = stats.year?.byVice?.find(v => v.vice.id === vice.id)?.spend || 0;
                    const pct = totalSpend > 0 ? Math.round((viceSpend / totalSpend) * 100) : 0;
                    return (
                      <div key={vice.id} style={{ marginBottom: 10 }}>
                        <div className="savings-row" style={{ marginBottom: 4 }}>
                          <span>{vice.emoji} {vice.name}</span>
                          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <strong className="text-money">{fmt$(viceSpend)}</strong>
                            <span className="text-muted" style={{ fontSize: 11 }}>{pct}%</span>
                          </span>
                        </div>
                        {totalSpend > 0 && (
                          <div className="budget-bar">
                            <div className="budget-bar-fill" style={{ width: `${pct}%`, background: vice.color || 'var(--money)' }} />
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
                <div className="savings-divider" />
                <div className="savings-row"><span>Avg daily spend</span><strong>{fmt$(stats.avg_daily_spend)}</strong></div>
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
                            <span className="text-money entry-label">{e.vice.emoji} {e.vice.name} · Zero logged</span>
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
