import { useState, useEffect, useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend
} from 'chart.js';
import { useApi } from '../useApi';
import { useViceContext } from '../ViceContext';
import { formatQuantityWithUnit, getUnitLabel } from '../formatUnits';

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

export default function Dashboard() {
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;

  const { vices, activeViceId } = useViceContext();
  const [stats, setStats] = useState(null);
  const [last7, setLast7] = useState([]);
  const [recentEntries, setRecentEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  const activeVice = vices.find(v => v.id === activeViceId);
  const activeUnitLabel = getUnitLabel(activeVice);
  const moneyColor = typeof document !== 'undefined'
    ? (getComputedStyle(document.body).getPropertyValue('--money').trim() || '#5ec48a')
    : '#5ec48a';
  const inkColor = typeof document !== 'undefined'
    ? (getComputedStyle(document.body).getPropertyValue('--ink-3').trim() || '#8e9a85')
    : '#8e9a85';

  useEffect(() => {
    if (!activeViceId) return;
    setLoading(true);
    const dates = last7Dates();
    const from = dates[0], to = dates[6];
    Promise.all([
      apiRef.current(`/api/stats/${activeViceId}`),
      apiRef.current(`/api/entries?vice_id=${activeViceId}&from=${from}&to=${to}`),
      apiRef.current(`/api/entries?vice_id=${activeViceId}`),
    ]).then(([s, weekEntries, allEntries]) => {
      setStats(s);
      const byDate = {};
      weekEntries.forEach(e => { byDate[e.date.split('T')[0]] = e; });
      setLast7(dates.map(d => ({ date: d, entry: byDate[d] || null })));
      setRecentEntries(allEntries.slice(0, 10));
      setLoading(false);
    }).catch(console.error);
  }, [activeViceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const chartData = {
    labels: last7.map(({ date }) => {
      const d = new Date(date + 'T00:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
    }),
    datasets: [{
      label: activeUnitLabel,
      data: last7.map(({ entry }) => entry ? Number(entry.quantity) : 0),
      backgroundColor: last7.map(({ entry }) =>
        entry && Number(entry.quantity) === 0 ? moneyColor : inkColor
      ),
      borderRadius: 4,
    }]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: context => formatQuantityWithUnit(context.parsed.y, activeVice),
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(128,128,128,0.08)' },
        ticks: {
          color: inkColor,
          callback: value => formatQuantityWithUnit(value, activeVice),
        },
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
    <main className="main" style={{ '--vice-c': activeVice?.color }}>
      <div className="crumbs">
        <span>Vice Spending</span>
        <span className="sep">›</span>
        <span className="here">Dashboard</span>
        {activeVice && (
          <span className="crumb-pill">
            <span className="dot" />
            {activeVice.emoji} {activeVice.name}
          </span>
        )}
      </div>

      {loading ? <div className="loading">Loading…</div> : stats && (
        <>
          <div className="stats-strip">
            {[
              { key: 'Today', p: stats.today },
              { key: 'This week', p: stats.week },
              { key: 'This month', p: stats.month },
              { key: 'This year', p: stats.year },
            ].map(({ key, p }) => (
              <div key={key} className="stat">
                <div className="stat-key">{key}</div>
                <div className="stat-val">
                  {'$' + Number(p.spend || 0).toFixed(0)}
                  <span className="small">.{Number(p.spend || 0).toFixed(2).split('.')[1]}</span>
                </div>
                <div className="stat-delta">{formatQuantityWithUnit(p.quantity, activeVice)}</div>
              </div>
            ))}
          </div>

          <div className="grid-2">
            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">Savings summary</span>
              </div>
              <div className="savings-rows">
                <div className="savings-row"><span>Clean days logged</span><strong className="text-money">{stats.clean_days} days</strong></div>
                <div className="savings-row"><span>Saved from clean days</span><strong className="text-money">{fmt$(stats.savings_from_clean_days)}</strong></div>
                <div className="savings-row"><span>Avg {activeUnitLabel}/day</span><strong>{formatQuantityWithUnit(stats.avg_quantity_per_day, activeVice)}</strong></div>
                <div className="savings-row"><span>Avg price/{activeUnitLabel}</span><strong>{fmt$(stats.avg_price_per_unit)}</strong></div>
                <div className="savings-row"><span>Avg daily spend</span><strong>{fmt$(stats.avg_daily_spend)}</strong></div>
                <div className="savings-divider" />
                <div className="savings-row"><span>Quit · 30 days</span><strong className="text-money">{fmt$(stats.avg_daily_spend * 30)}</strong></div>
                <div className="savings-row"><span>Quit · 90 days</span><strong className="text-money">{fmt$(stats.avg_daily_spend * 90)}</strong></div>
                <div className="savings-row"><span>Quit · 1 year</span><strong className="text-money">{fmt$(stats.avg_daily_spend * 365)}</strong></div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">Last 7 days</span>
              </div>
              <div style={{ height: 220 }}>
                <Bar data={chartData} options={{ ...chartOptions, maintainAspectRatio: false }} />
              </div>
            </div>
          </div>

          <div className="grid-2">
            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">Averages</span>
              </div>
              <div className="savings-rows">
                <div className="savings-row"><span>Per {activeUnitLabel}</span><strong>{fmt$(stats.avg_price_per_unit)}</strong></div>
                <div className="savings-row"><span>{activeUnitLabel}/day</span><strong>{formatQuantityWithUnit(stats.avg_quantity_per_day, activeVice)}</strong></div>
                <div className="savings-row"><span>Daily spend</span><strong>{fmt$(stats.avg_daily_spend)}</strong></div>
                <div className="savings-row"><span>Total clean days</span><strong className="text-money">{stats.clean_days}</strong></div>
                <div className="savings-row"><span>Active days logged</span><strong>{stats.total_logged_days}</strong></div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">Recent entries</span>
              </div>
              {recentEntries.length === 0 ? (
                <p className="text-muted">No entries yet — go to Log to add one.</p>
              ) : (
                <div className="entry-list">
                  {recentEntries.map(e => {
                    const isClean = Number(e.quantity) === 0;
                    const d = new Date((e.date + '').split('T')[0] + 'T00:00:00');
                    return (
                      <div key={e.id} className={`entry-item ${isClean ? 'clean' : ''}`}>
                        <span className="entry-date">
                          {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        {isClean ? (
                          <>
                            <span className="text-money entry-label">Clean day</span>
                            <span className="text-money entry-saved">saved {fmt$(stats.avg_daily_spend)}</span>
                          </>
                        ) : (
                          <>
                            <span className="entry-qty">{formatQuantityWithUnit(e.quantity, activeVice)}</span>
                            <span className="entry-spend">{fmt$(e.quantity * e.price_per_unit)}</span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!loading && !stats && activeViceId && (
        <div className="empty-state">
          <div className="empty-icon">{activeVice?.emoji || '📊'}</div>
          <h2>No entries yet</h2>
          <p>Start logging on the <a href="/log">Log</a> page.</p>
        </div>
      )}
    </main>
  );
}
