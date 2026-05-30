import { useState, useEffect } from 'react';
import { useApi } from '../useApi';

const STEPS = [
  {
    icon: '🎯',
    title: 'Add your vices',
    body: 'Go to the Vices tab and add the habits you want to track — coffee, cigarettes, alcohol, takeout, or anything you spend money on.',
  },
  {
    icon: '📝',
    title: 'Log daily entries',
    body: 'Each day, open the Dashboard and log how much you consumed. Enter 0 to mark a clean day — your streak grows automatically.',
  },
  {
    icon: '📈',
    title: 'Watch your savings grow',
    body: 'The Savings tab shows how much you\'ve avoided spending and projects what that money could become if invested over time.',
  },
  {
    icon: '🤝',
    title: 'Add accountability partners',
    body: 'Invite friends from the Partners tab. Once they accept, you can each see the other\'s clean days and monthly totals to stay motivated.',
  },
];

const FAQS = [
  {
    q: 'What counts as a clean day?',
    a: 'A clean day is when you log an entry with a quantity of 0 for a vice. The app tracks consecutive clean days and shows your streaks on the Dashboard.',
  },
  {
    q: 'How are savings calculated?',
    a: 'Savings = days without spending × your default price per unit. The Savings page compounds this over time and shows investment equivalents at different return rates.',
  },
  {
    q: 'Can I track multiple vices?',
    a: 'Yes. Go to the Vices tab to add as many as you like. Each vice has its own emoji, unit label, default price, and optional monthly budget.',
  },
  {
    q: 'What can my accountability partners see?',
    a: 'Partners see your display name, your list of vice emojis, how many clean days you\'ve logged this month, and your total spending this month. They cannot see individual log entries.',
  },
  {
    q: 'Can I edit or delete a past entry?',
    a: 'Yes. On the Log Entry page or Dashboard, click Edit next to any entry to change the quantity or price.',
  },
  {
    q: 'Does demo mode save my data?',
    a: 'Demo mode stores data tied to your chosen username in the same database as real accounts. Creating a real account is recommended for long-term tracking.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Send us an email at the address below. We\'ll delete all your data within 48 hours.',
  },
];

const TRUST_POINTS = [
  { icon: '🔒', label: 'Your data is private', desc: 'Partners only see your clean-day count and monthly total — never individual entries.' },
  { icon: '📵', label: 'No ads, ever', desc: 'Vice to Value is funded by users, not advertisers. Your habits are never sold or shared.' },
  { icon: '🗑️', label: 'Delete anytime', desc: 'Request full account deletion via email and your data is gone within 48 hours.' },
];

const NOTIF_OPTIONS = [
  { key: 'notif_streak_risk',      label: 'Streak at risk',      desc: '8pm reminder if you haven\'t logged and your streak is ≥ 3 days' },
  { key: 'notif_streak_milestone', label: 'Streak milestones',   desc: 'Celebrate hitting 3, 7, 30, or 100 clean days' },
  { key: 'notif_badge_earned',     label: 'Badge unlocked',      desc: 'Notify when you earn a new badge' },
  { key: 'notif_level_up',         label: 'Level up',            desc: 'Notify when you reach a new XP level' },
  { key: 'notif_weekly_summary',   label: 'Weekly summary',      desc: 'Sunday morning recap: clean days, savings, streak' },
];

export default function Support() {
  const api = useApi();
  const [notifPrefs, setNotifPrefs] = useState(null);

  useEffect(() => {
    api('/api/notifications/preferences').then(setNotifPrefs).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePref = async (key) => {
    const next = !notifPrefs[key];
    setNotifPrefs(prev => ({ ...prev, [key]: next }));
    api('/api/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify({ [key]: next }),
    }).catch(() => {});
  };

  return (
    <main className="main">
      <div className="crumbs">
        <span>Vice Spending</span>
        <span className="sep">›</span>
        <span className="here">Support</span>
      </div>

      <div className="page-title">Support & FAQ</div>

      {/* How it works */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">How it works</span>
        </div>
        <div className="sup-steps">
          {STEPS.map((s, i) => (
            <div key={i} className="sup-step">
              <div className="sup-step-icon-wrap">
                <div className="sup-step-num">{i + 1}</div>
                <div className="sup-step-icon">{s.icon}</div>
              </div>
              <div>
                <div className="sup-step-title">{s.title}</div>
                <div className="sup-step-body">{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Frequently asked questions</span>
        </div>
        <div className="faq-list">
          {FAQS.map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} />
          ))}
        </div>
      </div>

      {/* Privacy & trust */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Your privacy</span>
        </div>
        <div className="sup-trust-grid">
          {TRUST_POINTS.map((t, i) => (
            <div key={i} className="sup-trust-card">
              <div className="sup-trust-icon">{t.icon}</div>
              <div className="sup-trust-label">{t.label}</div>
              <div className="sup-trust-desc">{t.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Notification preferences */}
      {notifPrefs && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">🔔 Notification preferences</span>
          </div>
          <div className="notif-pref-list">
            {NOTIF_OPTIONS.map(opt => (
              <label key={opt.key} className="notif-pref-row">
                <div className="notif-pref-info">
                  <div className="notif-pref-label">{opt.label}</div>
                  <div className="notif-pref-desc">{opt.desc}</div>
                </div>
                <div
                  className={`notif-toggle${notifPrefs[opt.key] !== false ? ' on' : ''}`}
                  onClick={() => togglePref(opt.key)}
                  role="switch"
                  aria-checked={notifPrefs[opt.key] !== false}
                >
                  <div className="notif-toggle-thumb" />
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Contact */}
      <div className="panel sup-contact-panel">
        <div className="sup-contact-icon">💬</div>
        <div className="sup-contact-title">Still need help?</div>
        <div className="sup-contact-sub">
          Send us an email and we'll get back to you within 24 hours.
        </div>
        <a className="btn" href="mailto:support@vicespending.com" style={{ marginTop: 20 }}>
          Email support
        </a>
      </div>
    </main>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item${open ? ' open' : ''}`}>
      <button className="faq-q" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span>{q}</span>
        <span className="faq-chevron" aria-hidden="true" />
      </button>
      <div className="faq-a-wrap">
        <div className="faq-a">{a}</div>
      </div>
    </div>
  );
}
