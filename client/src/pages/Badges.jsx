import { useState, useEffect } from 'react';
import { useApi } from '../useApi';

function fmtDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtProgress(progress) {
  if (!progress) return null;
  const { value, max, unit } = progress;
  if (unit) return `${Math.min(value, max)} / ${max} ${unit}`;
  if (max <= 30 && Number.isInteger(max)) {
    return `${Math.min(value, max)} / ${max} days`;
  }
  return `$${Math.min(value, max).toLocaleString(undefined, { maximumFractionDigits: 0 })} of $${max.toLocaleString()}`;
}

function SkeletonCard() {
  return (
    <div className="bdg-card bdg-locked">
      <div className="bdg-skel bdg-skel-emoji skeleton" />
      <div className="bdg-skel bdg-skel-name skeleton" />
      <div className="bdg-skel bdg-skel-desc skeleton" />
      <div className="bdg-skel bdg-skel-bar skeleton" />
    </div>
  );
}

function BadgeCard({ badge }) {
  const pct = badge.progress
    ? Math.min(100, (badge.progress.value / badge.progress.max) * 100)
    : 0;
  const label = fmtProgress(badge.progress);

  return (
    <div className={`bdg-card${badge.earned ? ' bdg-earned' : ' bdg-locked'}`}>
      <div className="bdg-emoji">{badge.emoji}</div>
      <div className="bdg-name">{badge.name}</div>
      <div className="bdg-desc">{badge.description}</div>

      {badge.earned ? (
        <div className="bdg-earned-row">
          <span className="bdg-check">✓</span>
          <span className="bdg-date">{fmtDate(badge.earned_at)}</span>
        </div>
      ) : label ? (
        <div className="bdg-progress">
          <div className="bdg-bar-label">{label}</div>
          <div className="bdg-bar-track">
            <div className="bdg-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Badges() {
  const api = useApi();
  const [data, setData]   = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick]   = useState(0);

  useEffect(() => {
    setError(null);
    api('/api/badges')
      .then(setData)
      .catch(err => setError(err?.message || 'Could not load badges'));
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const earnedCount = data?.badges.filter(b => b.earned).length ?? 0;
  const total       = data?.badges.length ?? 0;

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
            {data ? `${earnedCount} of ${total} unlocked` : 'Track your milestones'}
          </p>
        </div>
      </div>

      {/* Stats strip */}
      {data && (
        <div className="bdg-stats-strip">
          <div className="bdg-stat">
            <div className="bdg-stat-val">{earnedCount}</div>
            <div className="bdg-stat-label">Earned</div>
          </div>
          <div className="bdg-stat">
            <div className="bdg-stat-val">{data.current_streak ?? 0}</div>
            <div className="bdg-stat-label">Day streak</div>
          </div>
          <div className="bdg-stat">
            <div className="bdg-stat-val">{data.longest_streak ?? 0}</div>
            <div className="bdg-stat-label">Longest</div>
          </div>
          <div className="bdg-stat">
            <div className="bdg-stat-val">{data.total_clean_days ?? 0}</div>
            <div className="bdg-stat-label">Clean days</div>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bdg-error">
          <span className="bdg-error-msg">⚠ {error}</span>
          <button className="btn ghost" onClick={() => setTick(t => t + 1)} style={{ fontSize: 13 }}>
            Retry
          </button>
        </div>
      )}

      {/* Badge grid */}
      {!data && !error ? (
        <div className="bdg-grid">
          {Array.from({ length: 13 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : data ? (
        <>
          <div className="bdg-grid">
            {data.badges.map(badge => <BadgeCard key={badge.id} badge={badge} />)}
          </div>
          {earnedCount === 0 && (
            <div className="bdg-empty">
              <span className="bdg-empty-emoji">🌱</span>
              <p className="bdg-empty-title">Your first badge is close</p>
              <p className="bdg-empty-sub">Log your first entry or hit a 3-day streak to unlock your first badge.</p>
            </div>
          )}
        </>
      ) : null}
    </main>
  );
}
