import { useRef, useEffect, useState } from 'react';

export function GoalsSection({
  goals, savings, avgDailySpend,
  showForm, setShowForm,
  goalTitle, setGoalTitle,
  goalAmt, setGoalAmt,
  goalError,
  onCreateGoal, onDeleteGoal,
}) {
  const active = goals.filter(g => !g.completed_at);
  const done   = goals.filter(g =>  g.completed_at);

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">Savings goals</span>
        {!showForm && (
          <button
            className="btn ghost"
            style={{ fontSize: 12, padding: '6px 12px' }}
            onClick={() => setShowForm(true)}
          >+ New goal</button>
        )}
      </div>

      {showForm && (
        <form className="goal-form" onSubmit={onCreateGoal}>
          <div className="goal-form-row">
            <input
              className="form-input"
              placeholder="Goal title — e.g. New AirPods"
              value={goalTitle}
              onChange={e => setGoalTitle(e.target.value)}
              required
              autoFocus
              style={{ flex: 1 }}
            />
            <input
              className="form-input"
              type="number"
              placeholder="Target $"
              value={goalAmt}
              onChange={e => setGoalAmt(e.target.value)}
              min="1"
              step="0.01"
              required
              style={{ width: 110 }}
            />
            <button className="btn" type="submit" disabled={!goalTitle.trim() || !goalAmt}>Save</button>
            <button className="btn ghost" type="button" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          {goalError && <div className="form-error" style={{ marginTop: 6 }}>{goalError}</div>}
        </form>
      )}

      {active.length === 0 && !showForm && (
        <p style={{ color: 'var(--ink-3)', fontSize: 14, padding: '8px 0' }}>
          Set a savings goal and your tracked savings will fund it.
        </p>
      )}

      {active.length > 0 && (
        <div className="goals-grid">
          {active.map(goal => {
            const target  = Number(goal.target_amount);
            const pct     = Math.min(100, (savings / target) * 100);
            const remaining = Math.max(0, target - savings);
            const daysEst = avgDailySpend > 0 ? Math.ceil(remaining / avgDailySpend) : null;
            const reached = pct >= 100;

            return (
              <div key={goal.id} className={`goal-card${reached ? ' reached' : ''}`}>
                <div className="goal-card-top">
                  <div className="goal-card-title">{goal.title}</div>
                  <button className="goal-delete" onClick={() => onDeleteGoal(goal.id)} title="Remove">×</button>
                </div>
                <div className="goal-amounts">
                  <span className="goal-saved">${savings.toFixed(0)}</span>
                  <span className="goal-sep"> of </span>
                  <span className="goal-target">${target.toFixed(0)}</span>
                </div>
                <div className="goal-bar-track">
                  <div className="goal-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="goal-bar-foot">
                  <span className="goal-pct">{pct.toFixed(0)}%</span>
                  {reached
                    ? <span className="goal-reached-badge">Reached! 🎉</span>
                    : daysEst !== null
                      ? <span className="goal-days">~{daysEst} days away</span>
                      : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {done.length > 0 && (
        <>
          <div className="goals-achieved-head">Achieved</div>
          <div className="goals-achieved-list">
            {done.map(goal => {
              const d = new Date(goal.completed_at);
              return (
                <div key={goal.id} className="goal-achieved-row">
                  <span className="goal-achieved-check">✓</span>
                  <span className="goal-achieved-title">{goal.title}</span>
                  <span className="goal-achieved-amt">${Number(goal.target_amount).toFixed(0)}</span>
                  <span className="goal-achieved-date">
                    {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <button className="goal-delete" style={{ marginLeft: 'auto' }} onClick={() => onDeleteGoal(goal.id)} title="Remove">×</button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function CelebOverlay({ goal, onComplete, onDismiss }) {
  const [phase, setPhase] = useState('confetti');
  useEffect(() => {
    const t = setTimeout(() => setPhase('card'), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="celeb-overlay" onClick={onDismiss}>
      <Confetti />
      {phase === 'card' && (
        <div className="celeb-card" onClick={e => e.stopPropagation()}>
          <div className="celeb-check">✓</div>
          <div className="celeb-kicker">Goal reached!</div>
          <div className="celeb-title">{goal.title}</div>
          <div className="celeb-amount">${Number(goal.target_amount).toFixed(0)}</div>
          <div className="celeb-sub">Your tracked savings added up to something real.</div>
          <div className="celeb-actions">
            <button className="btn" onClick={onComplete}>Mark achieved</button>
            <button className="btn ghost" onClick={onDismiss}>Keep tracking</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Confetti() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    const COLORS = ['#0F6E56', '#5ec48a', '#ffd700', '#ff9f43', '#74c0fc', '#ffffff'];
    const pieces = Array.from({ length: 160 }, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * -canvas.height * 0.6,
      vx:    (Math.random() - 0.5) * 7,
      vy:    Math.random() * 5 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      w:     Math.random() * 12 + 4,
      h:     Math.random() * 7  + 3,
      angle: Math.random() * Math.PI * 2,
      spin:  (Math.random() - 0.5) * 0.25,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.13; p.angle += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.angle);
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
