import { useState } from 'react';

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  } catch {
    return String(value).slice(0, 10);
  }
}

function contactFor(user) {
  if (user.email) return { label: user.email, type: 'Email' };
  if (user.wallet_address) return { label: user.wallet_address, type: 'Wallet' };
  return { label: '—', type: '—' };
}

export default function AdminUsers() {
  const [secret, setSecret] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [state, setState] = useState({ loading: false, error: '', users: [], count: 0 });

  function loadUsers(adminSecret) {
    setState({ loading: true, error: '', users: [], count: 0 });
    fetch('/api/admin/users', {
      headers: { 'x-admin-secret': adminSecret },
    })
      .then(r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'Wrong admin secret.' : `Error ${r.status}`);
        return r.json();
      })
      .then(data => setState({ loading: false, error: '', users: data.users || [], count: data.count || 0 }))
      .catch(err => setState({ loading: false, error: err.message || 'Could not load users.', users: [], count: 0 }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!secret.trim()) return;
    setSubmitted(true);
    loadUsers(secret.trim());
  }

  return (
    <main className="main">
      <div className="crumbs">
        <span>Vice to Value</span>
        <span className="sep">›</span>
        <span className="here">Admin</span>
      </div>
      <div className="page-title">User Management</div>

      {!submitted && (
        <div className="panel" style={{ maxWidth: 420 }}>
          <div className="panel-head">
            <span className="panel-title">Admin access</span>
          </div>
          <p style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.6, marginTop: 0, marginBottom: 16 }}>
            Enter your ADMIN_SECRET to view signed-up users. This is the value you set in Vercel → Settings → Environment Variables.
          </p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              className="form-input"
              placeholder="ADMIN_SECRET"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              autoComplete="current-password"
            />
            <button type="submit" className="btn-primary">View Users</button>
          </form>
        </div>
      )}

      {submitted && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Signed-up users</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {!state.loading && !state.error && (
                <span className="form-hint">{state.count} total</span>
              )}
              <button
                className="btn-ghost"
                style={{ fontSize: 12 }}
                onClick={() => { setSubmitted(false); setSecret(''); setState({ loading: false, error: '', users: [], count: 0 }); }}
              >
                Lock
              </button>
              {!state.loading && (
                <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => loadUsers(secret.trim())}>
                  Refresh
                </button>
              )}
            </div>
          </div>

          <p style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
            Privacy-safe view — shows contact identity, auth type, and joined date only.
          </p>

          {state.loading && <div className="skeleton skeleton-card" style={{ height: 120 }} />}

          {state.error && (
            <div className="form-error" style={{ marginTop: 12 }}>
              {state.error}
            </div>
          )}

          {!state.loading && !state.error && (
            <div style={{ overflowX: 'auto', marginTop: 16 }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Contact</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Auth</th>
                    <th style={styles.th}>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {state.users.map(user => {
                    const contact = contactFor(user);
                    return (
                      <tr key={user.id}>
                        <td style={styles.td}>
                          <div style={styles.contact}>{contact.label}</div>
                        </td>
                        <td style={styles.td}>{contact.type}</td>
                        <td style={styles.td}>{user.auth_type || 'unknown'}</td>
                        <td style={styles.td}>{formatDate(user.joined_at)}</td>
                      </tr>
                    );
                  })}
                  {state.users.length === 0 && (
                    <tr>
                      <td style={styles.td} colSpan="4">No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

const styles = {
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 560,
  },
  th: {
    textAlign: 'left',
    color: 'var(--ink-3)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    borderBottom: '1px solid var(--rule)',
    padding: '10px 12px',
  },
  td: {
    color: 'var(--ink-2)',
    borderBottom: '1px solid var(--rule)',
    padding: '12px',
    fontSize: 14,
    verticalAlign: 'top',
  },
  contact: {
    color: 'var(--ink)',
    fontFamily: 'var(--mono, monospace)',
    fontSize: 13,
    wordBreak: 'break-all',
  },
};
