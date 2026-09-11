import { useState, useEffect } from 'react';
import { useApi } from '../useApi';
import { BadgeCelebOverlay } from './BadgeCelebOverlay';

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

function BadgeCard({ badge, onRemove }) {
  const pct = badge.progress
    ? Math.min(100, (badge.progress.value / badge.progress.max) * 100)
    : 0;
  const label = fmtProgress(badge.progress);

  return (
    <div className={`bdg-card${badge.earned ? ' bdg-earned' : ' bdg-locked'}`} style={{ position: 'relative' }}>
      {badge.custom && onRemove && (
        <button
          className="goal-delete"
          style={{ position: 'absolute', top: 8, right: 8 }}
          onClick={() => onRemove(badge)}
          title="Remove custom badge"
        >×</button>
      )}
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
  const [checking, setChecking]   = useState(false);
  const [checkMsg, setCheckMsg]   = useState('');
  const [newBadges, setNewBadges] = useState([]);

  useEffect(() => {
    setError(null);
    api('/api/badges')
      .then(setData)
      .catch(err => setError(err?.message || 'Could not load badges'));
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkForBadges = async () => {
    setChecking(true);
    setCheckMsg('');
    try {
      const { newly_earned } = await api('/api/badges/check', { method: 'POST' });
      if (newly_earned?.length) {
        setNewBadges(newly_earned);
        setTick(t => t + 1);
      } else {
        setCheckMsg('No new badges yet — keep logging.');
        setTimeout(() => setCheckMsg(''), 3000);
      }
    } catch (err) {
      setCheckMsg(err?.message || 'Could not check badges. Try again.');
    } finally {
      setChecking(false);
    }
  };

  const [showForm, setShowForm]   = useState(false);
  const [prompt, setPrompt]       = useState('');
  const [creating, setCreating]   = useState(false);
  const [formError, setFormError] = useState('');

  const createBadge = async (e) => {
    e.preventDefault();
    setFormError('');
    setCreating(true);
    try {
      const { badge, newly_earned } = await api('/api/badges/custom', {
        method: 'POST',
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      setData(d => d ? { ...d, badges: [...d.badges, badge] } : d);
      if (newly_earned?.length) setNewBadges(newly_earned);
      setPrompt('');
      setShowForm(false);
    } catch (err) {
      setFormError(err?.message || 'Could not create that badge. Try again.');
    } finally {
      setCreating(false);
    }
  };

  const removeBadge = async (badge) => {
    try {
      await api(`/api/badges/custom/${badge.custom_id}`, { method: 'DELETE' });
      setData(d => d ? { ...d, badges: d.badges.filter(b => b.id !== badge.id) } : d);
    } catch (err) { console.error('removeBadge failed:', err); }
  };

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
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              className="btn ghost"
              style={{ fontSize: 12, padding: '6px 12px' }}
              onClick={checkForBadges}
              disabled={checking || !data}
            >{checking ? 'Checking…' : 'Check for new'}</button>
            {!showForm && (
              <button
                className="btn"
                style={{ fontSize: 12, padding: '6px 12px' }}
                onClick={() => { setShowForm(true); setFormError(''); }}
                disabled={!data}
              >+ Add badge</button>
            )}
          </div>
          {checkMsg && (
            <div style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 6 }}>{checkMsg}</div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="panel" style={{ marginBottom: 22 }}>
          <div className="panel-head">
            <span className="panel-title">Describe your badge</span>
          </div>
          <form className="goal-form" onSubmit={createBadge}>
            <div className="goal-form-row">
              <input
                className="form-input"
                placeholder='e.g. "Save $3,000" or "Two weeks clean in a row" or "Log 50 days"'
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                maxLength={300}
                required
                autoFocus
                disabled={creating}
                style={{ flex: 1 }}
              />
              <button className="btn" type="submit" disabled={creating || prompt.trim().length < 3}>
                {creating ? 'Building…' : 'Create'}
              </button>
              <button className="btn ghost" type="button" onClick={() => { setShowForm(false); setFormError(''); }} disabled={creating}>
                Cancel
              </button>
            </div>
            <p style={{ color: 'var(--ink-3)', fontSize: 12, margin: '8px 0 0' }}>
              Badges can track your savings balance, best clean streak, total clean days, days logged, or partners connected. It unlocks automatically when you get there.
            </p>
            {formError && <div className="form-error" style={{ marginTop: 6 }}>{formError}</div>}
          </form>
        </div>
      )}

      {newBadges.length > 0 && (
        <BadgeCelebOverlay badges={newBadges} onDismiss={() => setNewBadges([])} />
      )}

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
          {Array.from({ length: 20 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : data ? (
        <>
          <div className="bdg-grid">
            {data.badges.map(badge => <BadgeCard key={badge.id} badge={badge} onRemove={removeBadge} />)}
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
