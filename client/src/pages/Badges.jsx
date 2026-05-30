import { useState, useEffect } from 'react';
import { useApi } from '../useApi';

function fmtDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtProgress(progress) {
  if (!progress) return null;
  const { value, max } = progress;
  if (max <= 30 && Number.isInteger(max)) {
    return `${Math.min(value, max)} / ${max} days`;
  }
  return `$${Number(value).toFixed(0)} of $${max.toLocaleString()}`;
}

function BadgeCard({ badge }) {
  const pct = badge.progress
    ? Math.min(100, (badge.progress.value / badge.progress.max) * 100)
    : 0;

  return (
    <div className={`bdg-card${badge.earned ? ' bdg-earned' : ' bdg-locked'}`}>
      <div className="bdg-emoji">{badge.earned ? badge.emoji : '🔒'}</div>
      <div className="bdg-name">{badge.name}</div>
      <div className="bdg-desc">{badge.description}</div>
      {badge.earned ? (
        <div className="bdg-date">Earned {fmtDate(badge.earned_at)}</div>
      ) : badge.progress ? (
        <div className="bdg-progress">
          <div className="bdg-bar-track">
            <div className="bdg-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="bdg-bar-label">{fmtProgress(badge.progress)}</div>
        </div>
      ) : null}
    </div>
  );
}

export default function Badges() {
  const api = useApi();
  const [data, setData] = useState(null);

  useEffect(() => {
    api('/api/badges').then(setData).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const earnedCount = data?.badges.filter(b => b.earned).length ?? 0;
  const total = data?.badges.length ?? 0;

  return (
    <main className="main">
      <div className="crumbs">
        <span>Vice Spending</span>
        <span className="sep">›</span>
        <span className="here">Badges</span>
      </div>

      <div className="dashboard-head">
        <div>
          <div className="page-title">Badges</div>
          <p className="page-subtitle">
            {data
              ? `${earnedCount} of ${total} unlocked`
              : 'Track your milestones'}
          </p>
        </div>
      </div>


      {data ? (
        <div className="bdg-grid">
          {data.badges.map(badge => (
            <BadgeCard key={badge.id} badge={badge} />
          ))}
        </div>
      ) : (
        <div className="bdg-grid">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bdg-card bdg-locked skeleton" style={{ minHeight: 130 }} />
          ))}
        </div>
      )}
    </main>
  );
}
