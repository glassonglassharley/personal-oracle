import { useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

const AUTH_COLORS = {
  password:     { bg: 'rgba(94,196,138,0.15)',  color: '#5ec48a',  label: 'Password' },
  'magic-link': { bg: 'rgba(116,192,252,0.15)', color: '#74c0fc',  label: 'Magic Link' },
  clerk:        { bg: 'rgba(171,71,188,0.15)',  color: '#ab47bc',  label: 'Clerk' },
};

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function timeSince(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  if (months < 12) return `${months} months ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function AdminDashboard() {
  const [secret, setSecret]   = useState('');
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');

  const fetchUsers = useCallback(async (s = secret) => {
    if (!s.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        headers: { 'x-admin-secret': s.trim() },
      });
      if (res.status === 401) throw new Error('Wrong admin secret.');
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [secret]);

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchUsers();
  };

  const filtered = data?.users?.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u.username || '').toLowerCase().includes(q) ||
      (u.email    || '').toLowerCase().includes(q) ||
      (u.name     || '').toLowerCase().includes(q)
    );
  }) ?? [];

  const exportCSV = () => {
    if (!filtered.length) return;
    const headers = ['ID', 'Username', 'Email', 'Name', 'Auth Type', 'Signed Up', 'Vices', 'Entries', 'Last Active'];
    const rows = filtered.map(u => [
      u.id, u.username, u.email || '', u.name || '', u.auth_type,
      fmt(u.created_at), u.vice_count, u.entry_count, fmt(u.last_entry_date),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vice-tracker-users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Admin · Users</h1>
          <p style={s.sub}>All accounts — password, magic link, and wallet auth</p>
        </div>
        {data && (
          <div style={s.headerStats}>
            <span style={s.statPill}>{data.count} total</span>
            <span style={{ ...s.statPill, ...AUTH_COLORS.password }}>
              {data.users.filter(u => u.auth_type === 'password').length} password
            </span>
            <span style={{ ...s.statPill, ...AUTH_COLORS['magic-link'] }}>
              {data.users.filter(u => u.auth_type === 'magic-link').length} magic link
            </span>
            <span style={{ ...s.statPill, ...AUTH_COLORS.clerk }}>
              {data.users.filter(u => u.auth_type === 'clerk').length} clerk
            </span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} style={s.authRow}>
        <input
          type="password"
          placeholder="Admin secret"
          value={secret}
          onChange={e => setSecret(e.target.value)}
          style={s.secretInput}
          autoComplete="off"
        />
        <button type="submit" style={s.btn} disabled={loading || !secret.trim()}>
          {loading ? 'Loading…' : data ? 'Refresh' : 'Load users'}
        </button>
        {data && (
          <button type="button" style={{ ...s.btn, ...s.btnGhost }} onClick={exportCSV}>
            ↓ CSV
          </button>
        )}
      </form>

      {error && <div style={s.error}>{error}</div>}

      {data && (
        <>
          <input
            type="text"
            placeholder="Search username, email, or name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...s.secretInput, marginBottom: 16, maxWidth: '100%' }}
          />

          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['#', 'Auth', 'Username', 'Email', 'Name', 'Signed up', 'Vices', 'Entries', 'Last active'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ ...s.td, textAlign: 'center', color: '#666', padding: '24px 0' }}>
                      No users match "{search}"
                    </td>
                  </tr>
                ) : filtered.map((u, i) => {
                  const at = AUTH_COLORS[u.auth_type] || AUTH_COLORS.password;
                  return (
                    <tr key={u.id} style={i % 2 === 0 ? {} : s.rowAlt}>
                      <td style={{ ...s.td, color: '#555', fontSize: 11 }}>{u.id}</td>
                      <td style={s.td}>
                        <span style={{ ...s.badge, background: at.bg, color: at.color }}>
                          {at.label}
                        </span>
                      </td>
                      <td style={{ ...s.td, fontWeight: 600, color: '#f0f7ec' }}>{u.username || '—'}</td>
                      <td style={{ ...s.td, color: '#aaa' }}>{u.email || '—'}</td>
                      <td style={{ ...s.td, color: '#aaa' }}>{u.name || '—'}</td>
                      <td style={{ ...s.td, color: '#aaa', whiteSpace: 'nowrap' }}>
                        {fmt(u.created_at)}
                        <div style={{ fontSize: 10, color: '#555', marginTop: 1 }}>{timeSince(u.created_at)}</div>
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' }}>{u.vice_count || 0}</td>
                      <td style={{ ...s.td, textAlign: 'center' }}>{u.entry_count || 0}</td>
                      <td style={{ ...s.td, color: '#aaa', whiteSpace: 'nowrap', fontSize: 12 }}>
                        {timeSince(u.last_entry_date)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#0a0f0a',
    padding: '32px 24px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#f0f7ec',
    maxWidth: 1100,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 28,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    color: '#f0f7ec',
    letterSpacing: '-.02em',
  },
  sub: {
    margin: '4px 0 0',
    fontSize: 13,
    color: '#555',
  },
  headerStats: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  statPill: {
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 20,
    background: 'rgba(240,247,236,0.08)',
    color: '#aaa',
  },
  authRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  secretInput: {
    flex: 1,
    minWidth: 220,
    background: '#111',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    padding: '9px 14px',
    fontSize: 14,
    color: '#f0f7ec',
    outline: 'none',
  },
  btn: {
    background: '#5ec48a',
    color: '#040c06',
    border: 'none',
    borderRadius: 8,
    padding: '9px 18px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnGhost: {
    background: 'transparent',
    color: '#aaa',
    border: '1px solid #2a2a2a',
  },
  error: {
    background: 'rgba(217,88,58,0.15)',
    color: '#d9583a',
    border: '1px solid rgba(217,88,58,0.3)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: 16,
  },
  tableWrap: {
    overflowX: 'auto',
    borderRadius: 12,
    border: '1px solid #1e1e1e',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '10px 14px',
    background: '#111',
    color: '#555',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: '1px solid #1e1e1e',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '11px 14px',
    borderBottom: '1px solid #141414',
    color: '#ccc',
    fontSize: 13,
    verticalAlign: 'middle',
  },
  rowAlt: {
    background: 'rgba(255,255,255,0.015)',
  },
  badge: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 20,
    whiteSpace: 'nowrap',
  },
};
