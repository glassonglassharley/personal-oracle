import { useState, useEffect } from 'react';
import { useApi } from '../useApi';

function fmtDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StreakPill({ label, value, sub }) {
  return (
    <div className="streak-pill">
      <div className="streak-pill-val">{value}</div>
      <div className="streak-pill-label">{label}</div>
      {sub && <div className="streak-pill-sub">{sub}</div>}
    </div>
  );
}

function Badge({ badge }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className={`badge-card${badge.earned ? ' earned' : ' locked'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="badge-emoji">{badge.earned ? badge.emoji : '🔒'}</div>
      <div className="badge-name">{badge.name}</div>
      {badge.earned ? (
        <div className="badge-earned-date">Earned {fmtDate(badge.earned_at)}</div>
      ) : (
        <div className="badge-locked-hint">{badge.description}</div>
      )}
      {hovered && (
        <div className="badge-tooltip">{badge.description}</div>
      )}
    </div>
  );
}

export default function BadgesSection() {
  const api = useApi();
  const [data, setData] = useState(null);

  useEffect(() => {
    api('/api/badges').then(setData).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;

  const earnedCount = data.badges.filter(b => b.earned).length;

  return (
    <div className="badges-section">
      {/* ── Streak row ── */}
      <div className="streak-row">
        <StreakPill
          label="Current streak"
          value={data.current_streak}
          sub={data.current_streak === 1 ? 'clean day' : 'clean days'}
        />
        <StreakPill
          label="Longest streak"
          value={data.longest_streak}
          sub={data.longest_streak === 1 ? 'day' : 'days'}
        />
        <StreakPill
          label="Total clean days"
          value={data.total_clean_days}
          sub={data.total_clean_days === 1 ? 'day' : 'days'}
        />
      </div>

      {/* ── Badges grid ── */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Badges</span>
          <span className="badges-progress">
            {earnedCount} / {data.badges.length} unlocked
          </span>
        </div>
        <div className="badge-grid">
          {data.badges.map(badge => (
            <Badge key={badge.id} badge={badge} />
          ))}
        </div>
      </div>
    </div>
  );
}
