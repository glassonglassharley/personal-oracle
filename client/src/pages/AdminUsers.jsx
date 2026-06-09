import { useEffect, useState } from 'react';
import { useApi } from '../useApi';

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
  return { label: 'No email or wallet on file', type: 'Contact missing' };
}

export default function AdminUsers() {
  const api = useApi();
  const [state, setState] = useState({ loading: true, error: '', users: [], count: 0 });

  useEffect(() => {
    api('/api/users/admin/users')
      .then(data => setState({ loading: false, error: '', users: data.users || [], count: data.count || 0 }))
      .catch(err => setState({ loading: false, error: err.message || 'Could not load users.', users: [], count: 0 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="main">
      <div className="crumbs">
        <span>Vice to Value</span>
        <span className="sep">›</span>
        <span className="here">Admin</span>
      </div>
      <div className="page-title">User Management</div>

      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Signed-up users</span>
          {!state.loading && !state.error && (
            <span className="form-hint">{state.count} total</span>
          )}
        </div>

        <p style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
          Privacy-safe admin view. It only shows contact identity — email or connected wallet address — plus joined date and auth type. It does not show selected vices, entries, spending, streaks, savings, or partner data.
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
    </main>
  );
}

const styles = {
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 640,
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
    wordBreak: 'break-all',
  },
};
