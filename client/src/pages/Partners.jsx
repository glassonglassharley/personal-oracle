import { useState, useEffect, useCallback } from 'react';
import { useApi, useDemoAuth } from '../useApi';

export default function Partners() {
  const api = useApi();
  const { isDemo } = useDemoAuth();
  const [partners, setPartners] = useState([]);
  const [pending, setPending] = useState([]);
  const [sent, setSent] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState('');
  const [flashErr, setFlashErr] = useState('');

  const showFlash = (msg, isErr = false) => {
    if (isErr) { setFlashErr(msg); setTimeout(() => setFlashErr(''), 3500); }
    else { setFlash(msg); setTimeout(() => setFlash(''), 3000); }
  };

  const load = useCallback(() => {
    if (isDemo) { setLoading(false); return; }
    Promise.all([
      api('/api/partners'),
      api('/api/partners/pending'),
      api('/api/partners/sent'),
    ]).then(([p, pend, s]) => {
      setPartners(p);
      setPending(pend);
      setSent(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [api, isDemo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      setSearching(true);
      api(`/api/partners/search?q=${encodeURIComponent(searchQ)}`)
        .then(r => { setSearchResults(r); setSearching(false); })
        .catch(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendRequest = async (userId) => {
    try {
      await api('/api/partners/request', { method: 'POST', body: JSON.stringify({ user_id: userId }) });
      showFlash('Partner request sent!');
      setSearchResults(r => r.map(u => u.id === userId ? { ...u, relationship: 'pending' } : u));
    } catch (e) { showFlash(e.message, true); }
  };

  const acceptRequest = async (friendshipId) => {
    try {
      await api(`/api/partners/${friendshipId}/accept`, { method: 'PUT' });
      load();
    } catch (e) { showFlash(e.message, true); }
  };

  const removePartner = async (friendshipId) => {
    try {
      await api(`/api/partners/${friendshipId}`, { method: 'DELETE' });
      load();
    } catch (e) { showFlash(e.message, true); }
  };

  if (isDemo) {
    return (
      <main className="main">
        <h1 className="page-title">Accountability Partners</h1>
        <div className="empty-state">
          <div className="empty-icon">🤝</div>
          <h2>Sign in to connect with partners</h2>
          <p>Accountability partners require a real account. Create a free account to add partners and keep each other on track.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="main">
      <div className="page-header">
        <div>
          <h1 className="page-title">Accountability Partners</h1>
          <p className="page-subtitle">Add friends to keep each other on track with your spending goals.</p>
        </div>
      </div>

      {flashErr && <div className="ap-flash ap-flash-err">{flashErr}</div>}
      {flash    && <div className="ap-flash ap-flash-ok">{flash}</div>}

      {/* Search */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Find a partner <span className="small">by name</span></span>
        </div>
        <input
          className="form-input"
          placeholder="Search by name…"
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          style={{ width: '100%', marginBottom: 10 }}
        />
        {searching && <div className="loading">Searching…</div>}
        {!searching && searchQ.trim() && !searchResults.length && (
          <div className="loading">No users found</div>
        )}
        {searchResults.length > 0 && (
          <div className="ap-search-results">
            {searchResults.map(u => (
              <div key={u.id} className="ap-search-item">
                <div className="ap-avatar">{initials(u.name)}</div>
                <span className="ap-name">{u.name}</span>
                {u.relationship === 'accepted' && <span className="ap-tag">Partner</span>}
                {u.relationship === 'pending' && <span className="ap-tag muted">Requested</span>}
                {!u.relationship && (
                  <button className="btn" style={{ fontSize: 12, padding: '7px 13px' }} onClick={() => sendRequest(u.id)}>
                    Add partner
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Incoming requests */}
      {pending.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">
              Incoming requests <span className="small">{pending.length}</span>
            </span>
          </div>
          <div className="ap-list">
            {pending.map(u => (
              <div key={u.friendship_id} className="ap-item">
                <div className="ap-avatar">{initials(u.name)}</div>
                <div className="ap-info">
                  <div className="ap-name">{u.name}</div>
                  {u.vices?.length > 0 && (
                    <div className="ap-vices">
                      {u.vices.slice(0, 6).map((v, i) => <span key={i}>{v.emoji}</span>)}
                    </div>
                  )}
                </div>
                <div className="ap-actions">
                  <button className="btn" style={{ fontSize: 12, padding: '7px 13px' }} onClick={() => acceptRequest(u.friendship_id)}>Accept</button>
                  <button className="btn ghost" style={{ fontSize: 12, padding: '7px 13px' }} onClick={() => removePartner(u.friendship_id)}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active partners */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">
            Your partners <span className="small">{partners.length}</span>
          </span>
        </div>
        {loading ? (
          <div className="loading">Loading…</div>
        ) : partners.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 0' }}>
            <div className="empty-icon">🤝</div>
            <h2>No partners yet</h2>
            <p>Search above and send someone a partner request.</p>
          </div>
        ) : (
          <div className="ap-cards">
            {partners.map(p => (
              <div key={p.id} className="ap-card">
                <div className="ap-card-top">
                  <div className="ap-avatar large">{initials(p.name)}</div>
                  <div className="ap-card-info">
                    <div className="ap-name">{p.name}</div>
                    {p.vices?.length > 0 && (
                      <div className="ap-vices">
                        {p.vices.map((v, i) => <span key={i} title={v.name}>{v.emoji}</span>)}
                      </div>
                    )}
                  </div>
                  <button
                    className="btn ghost"
                    style={{ fontSize: 11, padding: '5px 10px', marginLeft: 'auto', alignSelf: 'flex-start' }}
                    onClick={() => removePartner(p.friendship_id)}
                  >Remove</button>
                </div>
                <div className="ap-stats">
                  <div className="ap-stat">
                    <div className="ap-stat-val">{p.clean_days_this_month}</div>
                    <div className="ap-stat-key">Clean days this month</div>
                  </div>
                  <div className="ap-stat">
                    <div className="ap-stat-val">${Number(p.spent_this_month || 0).toFixed(0)}</div>
                    <div className="ap-stat-key">Spent this month</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sent requests */}
      {sent.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">
              Sent requests <span className="small">{sent.length}</span>
            </span>
          </div>
          <div className="ap-list">
            {sent.map(u => (
              <div key={u.friendship_id} className="ap-item">
                <div className="ap-avatar">{initials(u.name)}</div>
                <div className="ap-info">
                  <div className="ap-name">{u.name}</div>
                  <div className="ap-meta">Awaiting response</div>
                </div>
                <button
                  className="btn ghost"
                  style={{ fontSize: 12, padding: '7px 13px' }}
                  onClick={() => removePartner(u.friendship_id)}
                >Cancel</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
