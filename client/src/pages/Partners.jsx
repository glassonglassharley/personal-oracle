import { useState, useEffect, useCallback } from 'react';
import { useApi, useDemoAuth } from '../useApi';

const LEVEL_ICONS = ['🌱','🌿','🪴','🌳','🌲','🌴','🏵️','💪','⭐','👑'];
const getLevelIcon = lvl => LEVEL_ICONS[Math.min(Math.max((lvl || 1) - 1, 0), 9)];

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
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [activeChatId, setActiveChatId] = useState(null);
  const [chatMessages, setChatMessages] = useState({});
  const [chatDrafts, setChatDrafts] = useState({});
  const [chatLoading, setChatLoading] = useState({});
  const [chatSending, setChatSending] = useState({});
  const [acceptingId, setAcceptingId] = useState(null);
  const [decliningId, setDecliningId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [challengingId, setChallengingId] = useState(null);
  const [sendingReqId, setSendingReqId] = useState(null);

  const showSuccess = msg => {
    setSuccessMsg(msg);
    setErrorMsg('');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const showError = msg => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 4000);
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
    setSendingReqId(userId);
    try {
      await api('/api/partners/request', { method: 'POST', body: JSON.stringify({ user_id: userId }) });
      showSuccess('Partner request sent!');
      setSearchResults(r => r.map(u => u.id === userId ? { ...u, relationship: 'pending' } : u));
    } catch (e) {
      showError(e.message || 'Could not send request.');
    } finally {
      setSendingReqId(null);
    }
  };

  const acceptRequest = async (friendshipId) => {
    setAcceptingId(friendshipId);
    try {
      await api(`/api/partners/${friendshipId}/accept`, { method: 'PUT' });
      showSuccess('Partner accepted!');
      load();
    } catch (e) {
      showError(e.message || 'Could not accept request.');
    } finally {
      setAcceptingId(null);
    }
  };

  const declineRequest = async (friendshipId) => {
    setDecliningId(friendshipId);
    try {
      await api(`/api/partners/${friendshipId}`, { method: 'DELETE' });
      load();
    } catch (e) {
      showError(e.message || 'Could not decline request.');
    } finally {
      setDecliningId(null);
    }
  };

  const removePartner = async (friendshipId) => {
    setRemovingId(friendshipId);
    try {
      await api(`/api/partners/${friendshipId}`, { method: 'DELETE' });
      load();
    } catch (e) {
      showError(e.message || 'Could not remove partner.');
    } finally {
      setRemovingId(null);
    }
  };

  const sendChallenge = async (partnerId) => {
    setChallengingId(partnerId);
    try {
      await api(`/api/partners/${partnerId}/challenge`, { method: 'POST' });
      showSuccess('Challenge sent! May the cleanest month win 🏆');
      load();
    } catch (e) {
      showError(e.message || 'Could not send challenge.');
    } finally {
      setChallengingId(null);
    }
  };

  const loadChat = async (partnerId) => {
    setChatLoading(prev => ({ ...prev, [partnerId]: true }));
    try {
      const messages = await api(`/api/partners/${partnerId}/messages`);
      setChatMessages(prev => ({ ...prev, [partnerId]: messages }));
    } catch (e) {
      showError(e.message || 'Could not load chat.');
    } finally {
      setChatLoading(prev => ({ ...prev, [partnerId]: false }));
    }
  };

  const toggleChat = (partnerId) => {
    const next = activeChatId === partnerId ? null : partnerId;
    setActiveChatId(next);
    if (next && !chatMessages[next]) loadChat(next);
  };

  const setChatDraft = (partnerId, value) => {
    setChatDrafts(prev => ({ ...prev, [partnerId]: value }));
  };

  const sendChat = async (partnerId) => {
    const body = String(chatDrafts[partnerId] || '').trim();
    if (!body) return;
    setChatSending(prev => ({ ...prev, [partnerId]: true }));
    try {
      const message = await api(`/api/partners/${partnerId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      setChatMessages(prev => ({
        ...prev,
        [partnerId]: [...(prev[partnerId] || []), message],
      }));
      setChatDraft(partnerId, '');
    } catch (e) {
      showError(e.message || 'Could not send message.');
    } finally {
      setChatSending(prev => ({ ...prev, [partnerId]: false }));
    }
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
  const hasLeaderboard = leaderboard.length > 1;

  return (
    <main className="main">
      <div className="crumbs">
        <span>Vice Spending</span>
        <span className="sep">›</span>
        <span className="here">Partners</span>
      </div>

      <div className="page-title">Accountability Partners</div>

      {errorMsg && <div className="inline-error" style={{ marginBottom: 16 }}>{errorMsg}</div>}
      {successMsg && <div className="inline-success" style={{ marginBottom: 16 }}>✓ {successMsg}</div>}

      {/* ── Leaderboard ── */}
      {loading ? (
        <div className="panel">
          <div className="panel-head"><div className="skeleton skeleton-text" style={{ width: 160 }} /></div>
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton skeleton-row" style={{ marginBottom: 6 }} />
          ))}
        </div>
      ) : hasLeaderboard && (
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
                    {row.level && <span className="lb-level-icon" title={`Level ${row.level}`}>{getLevelIcon(row.level)}</span>}
                  </div>
                  <div className="ap-vices">
                    {(row.vices || []).slice(0, 5).map((v, i) => <span key={i}>{v.emoji}</span>)}
                  </div>
                  {row.last_month_winner === 'them' && (
                    <div className="lb-trophy">🏆 Won last month</div>
                  )}
                  {row.last_month_winner === 'me' && (
                    <div className="lb-trophy lb-trophy-me">🏆 You won last month</div>
                  )}
                </div>
                <span className="lb-cell-right lb-streak" title="Current streak">{row.current_streak ?? 0}🔥</span>
                <span className="lb-cell-right lb-xp" title="Total XP">{(row.total_xp ?? 0).toLocaleString()} XP</span>
                <span className="lb-actions">
                  {!row.is_me && (
                    row.challenge
                      ? <span className="lb-challenged">⚔️ Challenged</span>
                      : <button
                          className="btn ghost"
                          style={{ fontSize: 11, padding: '5px 10px', whiteSpace: 'nowrap' }}
                          disabled={challengingId === row.id}
                          onClick={() => sendChallenge(row.id)}
                        >
                          {challengingId === row.id
                            ? <><div className="btn-spinner" />Sending…</>
                            : 'Challenge'
                          }
                        </button>
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
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <input
            className="form-input"
            placeholder="Search by name…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            style={{ width: '100%', paddingRight: searching ? 36 : undefined }}
          />
          {searching && (
            <div className="btn-spinner" style={{
              position: 'absolute', right: 12, top: '50%',
              transform: 'translateY(-50%)', margin: 0,
            }} />
          )}
        </div>
        {!searching && searchQ.trim() && !searchResults.length && (
          <div className="ap-no-results">No users found for "{searchQ}"</div>
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
                  <button
                    className="btn"
                    style={{ fontSize: 12, padding: '7px 13px' }}
                    disabled={sendingReqId === u.id}
                    onClick={() => sendRequest(u.id)}
                  >
                    {sendingReqId === u.id
                      ? <><div className="btn-spinner" />Sending…</>
                      : 'Add partner'
                    }
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
            <span className="panel-title">
              Incoming requests
              <span className="ap-count-badge">{pending.length}</span>
            </span>
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
                  <button
                    className="btn"
                    style={{ fontSize: 12, padding: '7px 13px' }}
                    disabled={acceptingId === u.friendship_id || decliningId === u.friendship_id}
                    onClick={() => acceptRequest(u.friendship_id)}
                  >
                    {acceptingId === u.friendship_id
                      ? <><div className="btn-spinner" />Accepting…</>
                      : 'Accept'
                    }
                  </button>
                  <button
                    className="btn ghost"
                    style={{ fontSize: 12, padding: '7px 13px' }}
                    disabled={acceptingId === u.friendship_id || decliningId === u.friendship_id}
                    onClick={() => declineRequest(u.friendship_id)}
                  >
                    {decliningId === u.friendship_id
                      ? <><div className="btn-spinner" />Declining…</>
                      : 'Decline'
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Active partners ── */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">
            Your partners
            {!loading && <span className="ap-count-badge">{partners.length}</span>}
          </span>
        </div>
        {loading ? (
          <div className="ap-skeleton-cards">
            {[0, 1].map(i => (
              <div key={i} className="skeleton skeleton-card" style={{ height: 130 }} />
            ))}
          </div>
        ) : partners.length === 0 ? (
          <div className="ap-empty">
            <div className="ap-empty-icon">🤝</div>
            <div className="ap-empty-title">No partners yet</div>
            <div className="ap-empty-sub">Search above to find a friend and send a partner request.</div>
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
                  <div className="ap-card-actions">
                    <button
                      className={`btn ${activeChatId === p.id ? '' : 'ghost'}`}
                      type="button"
                      style={{ fontSize: 11, padding: '5px 10px' }}
                      onClick={() => toggleChat(p.id)}
                    >{activeChatId === p.id ? 'Close chat' : 'Chat'}</button>
                    <button
                      className="btn ghost"
                      type="button"
                      style={{ fontSize: 11, padding: '5px 10px' }}
                      disabled={removingId === p.friendship_id}
                      onClick={() => removePartner(p.friendship_id)}
                    >
                      {removingId === p.friendship_id
                        ? <><div className="btn-spinner" />Removing…</>
                        : 'Remove'
                      }
                    </button>
                  </div>
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
                {activeChatId === p.id && (
                  <div className="ap-chat">
                    <div className="ap-chat-head">
                      <span>Chat with {p.name}</span>
                      <button className="ap-chat-refresh" type="button" onClick={() => loadChat(p.id)} disabled={chatLoading[p.id]}>
                        {chatLoading[p.id] ? <><div className="btn-spinner" />Refreshing…</> : 'Refresh'}
                      </button>
                    </div>
                    <div className="ap-chat-messages" aria-live="polite">
                      {chatLoading[p.id] && !chatMessages[p.id] ? (
                        <div className="ap-chat-empty">
                          <div className="btn-spinner" style={{ margin: '0 auto 8px' }} />
                          Loading chat…
                        </div>
                      ) : (chatMessages[p.id] || []).length === 0 ? (
                        <div className="ap-chat-empty">No messages yet. Send a quick check-in. 👋</div>
                      ) : (
                        chatMessages[p.id].map(message => (
                          <div key={message.id} className={`ap-chat-bubble ${message.is_me ? 'me' : 'them'}`}>
                            <div className="ap-chat-body">{message.body}</div>
                            <div className="ap-chat-meta">
                              {message.is_me ? 'You' : (message.sender_name || p.name)} · {formatMessageTime(message.created_at)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <form
                      className="ap-chat-compose"
                      onSubmit={event => { event.preventDefault(); sendChat(p.id); }}
                    >
                      <textarea
                        className="ap-chat-input"
                        value={chatDrafts[p.id] || ''}
                        maxLength={1000}
                        rows={2}
                        placeholder={`Message ${p.name}…`}
                        onChange={event => setChatDraft(p.id, event.target.value)}
                      />
                      <button className="btn" type="submit" disabled={chatSending[p.id] || !String(chatDrafts[p.id] || '').trim()}>
                        {chatSending[p.id]
                          ? <><div className="btn-spinner" />Sending…</>
                          : 'Send'
                        }
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Sent requests ── */}
      {sent.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">
              Sent requests
              <span className="ap-count-badge">{sent.length}</span>
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
                  disabled={removingId === u.friendship_id}
                  onClick={() => removePartner(u.friendship_id)}
                >
                  {removingId === u.friendship_id
                    ? <><div className="btn-spinner" />Cancelling…</>
                    : 'Cancel'
                  }
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function formatMessageTime(value) {
  if (!value) return 'now';
  try {
    return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return 'now';
  }
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
