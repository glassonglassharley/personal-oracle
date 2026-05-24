import { useState, useEffect, useCallback } from 'react';
import { useApi, useDemoAuth } from '../useApi';

const SPECIES_EMOJIS = { oak:'🌳', cherry_blossom:'🌸', pine:'🌲', willow:'🌿', maple:'🍁', baobab:'🌍', avocado:'🥑', bonsai:'🎋', palm:'🌴', cactus:'🌵', apple:'🍎', lemon:'🍋', banana:'🍌', redwood:'🏔️', bamboo:'🎍', olive:'🫒', mango:'🥭', weeping_willow:'🌾', rainbow_eucalyptus:'🌈', dragon_blood:'🔮' };
const ARCHETYPE_EMOJIS = { warrior:'⚔️', wizard:'🧙', knight:'🏰', archer:'🏹', monk:'🧘', bodybuilder:'💪', athlete:'🏆', ninja:'🥷', samurai:'⛩️', viking:'🪓', pirate:'🏴‍☠️', explorer:'🧭', scientist:'🔬', artist:'🎨', chef:'👨‍🍳', astronaut:'🚀', superhero:'🦸', rockstar:'🎸', dancer:'💃', alchemist:'⚗️' };
const getSpeciesEmoji = id => SPECIES_EMOJIS[id] || '🌱';
const getArchetypeEmoji = id => ARCHETYPE_EMOJIS[id] || '⚔️';

export default function Partners() {
  const api = useApi();
  const { isDemo } = useDemoAuth();
  const [partners, setPartners] = useState([]);
  const [pending, setPending] = useState([]);
  const [sent, setSent] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
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
      api('/api/partners/leaderboard'),
    ]).then(([p, pend, s, lb]) => {
      setPartners(p);
      setPending(pend);
      setSent(s);
      setLeaderboard(lb);
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

  const sendChallenge = async (partnerId) => {
    try {
      await api(`/api/partners/${partnerId}/challenge`, { method: 'POST' });
      showFlash('Challenge sent! May the cleanest month win 🏆');
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

  const thisMonthLabel = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const hasLeaderboard = leaderboard.length > 1; // need at least 2 to be interesting

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

      {/* ── This Month Leaderboard ── */}
      {hasLeaderboard && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">
              This month <span className="small">{thisMonthLabel}</span>
            </span>
          </div>
          <div className="lb-table">
            <div className="lb-head">
              <span>#</span>
              <span>Name</span>
              <span className="lb-cell-right">Clean days</span>
              <span className="lb-cell-right">Spent</span>
              <span />
            </div>
            {leaderboard.map(row => (
              <div key={row.id} className={`lb-row${row.is_me ? ' lb-me' : ''}`}>
                <span className="lb-rank">
                  {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `#${row.rank}`}
                </span>
                <div className="lb-name-cell">
                  <div className="lb-name">
                    {row.name}
                    {row.is_me && <span className="lb-you-badge">you</span>}
                  </div>
                  <div className="ap-vices">
                    {(row.vices || []).slice(0, 5).map((v, i) => <span key={i}>{v.emoji}</span>)}
                  </div>
                  {/* Last month winner badge */}
                  {row.last_month_winner === 'them' && (
                    <div className="lb-trophy">🏆 Won last month</div>
                  )}
                  {row.last_month_winner === 'me' && (
                    <div className="lb-trophy lb-trophy-me">🏆 You won last month</div>
                  )}
                </div>
                <span className="lb-cell-right lb-clean">{row.clean_days}</span>
                <span className="lb-cell-right lb-spent">${Number(row.spent_this_month || 0).toFixed(0)}</span>
                <span className="lb-actions">
                  {!row.is_me && (
                    row.challenge
                      ? <span className="lb-challenged">⚔️ Challenged</span>
                      : <button
                          className="btn ghost"
                          style={{ fontSize: 11, padding: '5px 10px', whiteSpace: 'nowrap' }}
                          onClick={() => sendChallenge(row.id)}
                        >Challenge</button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Search ── */}
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

      {/* ── Incoming requests ── */}
      {pending.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Incoming requests <span className="small">{pending.length}</span></span>
          </div>
          <div className="ap-list">
            {pending.map(u => (
              <div key={u.friendship_id} className="ap-item">
                <div className="ap-avatar">{initials(u.name)}</div>
                <div className="ap-info">
                  <div className="ap-name">{u.name}</div>
                  {u.vices?.length > 0 && (
                    <div className="ap-vices">{u.vices.slice(0, 6).map((v, i) => <span key={i}>{v.emoji}</span>)}</div>
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

      {/* ── Active partners ── */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Your partners <span className="small">{partners.length}</span></span>
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
                      <div className="ap-vices">{p.vices.map((v, i) => <span key={i} title={v.name}>{v.emoji}</span>)}</div>
                    )}
                    {p.companion_type && p.companion_state && (
                      <div className="ap-companion-chip">
                        {p.companion_type === 'tree'
                          ? (p.companion_state.species ? getSpeciesEmoji(p.companion_state.species) : '🌱')
                          : (p.companion_state.archetype ? getArchetypeEmoji(p.companion_state.archetype) : '⚔️')}
                        {' '}{p.companion_state.name || (p.companion_type === 'tree' ? 'Tree' : 'Hero')}
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

      {/* ── Sent requests ── */}
      {sent.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Sent requests <span className="small">{sent.length}</span></span>
          </div>
          <div className="ap-list">
            {sent.map(u => (
              <div key={u.friendship_id} className="ap-item">
                <div className="ap-avatar">{initials(u.name)}</div>
                <div className="ap-info">
                  <div className="ap-name">{u.name}</div>
                  <div className="ap-meta">Awaiting response</div>
                </div>
                <button className="btn ghost" style={{ fontSize: 12, padding: '7px 13px' }} onClick={() => removePartner(u.friendship_id)}>Cancel</button>
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
