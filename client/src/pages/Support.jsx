import { useState } from 'react';

const STEPS = [
  {
    title: 'Add your vices',
    body: 'Go to the Vices tab and add the habits you want to track — coffee, cigarettes, alcohol, takeout, or anything you spend money on.',
  },
  {
    title: 'Log daily entries',
    body: 'Each day, open the Dashboard and log how much you consumed. Enter 0 to mark a clean day — your streak will grow automatically.',
  },
  {
    title: 'Watch your savings grow',
    body: 'The Savings tab shows how much you\'ve avoided spending and projects what that money could become if invested over time.',
  },
  {
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
    a: 'Yes. On the Dashboard, scroll to the entry list and click Edit next to any entry to change the quantity or price.',
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

export default function Support() {
  return (
    <main className="main">
      <div className="page-header">
        <div>
          <h1 className="page-title">Support</h1>
          <p className="page-subtitle">How to use Vice Spending and get help.</p>
        </div>
      </div>

      {/* How it works */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">How it works</span>
        </div>
        <div className="sup-steps">
          {STEPS.map((s, i) => (
            <div key={i} className="sup-step">
              <div className="sup-step-num">{i + 1}</div>
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
          <span className="panel-title">FAQ</span>
        </div>
        <div className="faq-list">
          {FAQS.map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} />
          ))}
        </div>
      </div>

      {/* Contact */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Still need help?</span>
        </div>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 18, lineHeight: 1.6 }}>
          Send us an email and we'll get back to you within 24 hours.
        </p>
        <a className="btn" href="mailto:support@vicespending.com">
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
      <button className="faq-q" onClick={() => setOpen(o => !o)}>
        <span>{q}</span>
        <span className="faq-chevron">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="faq-a">{a}</div>}
    </div>
  );
}
