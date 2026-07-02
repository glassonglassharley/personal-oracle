import { useState, useEffect } from 'react';
import { useApi, useDemoAuth } from '../useApi';

function loadPlaidScript() {
  return new Promise((resolve, reject) => {
    if (window.Plaid) return resolve();
    const script = document.createElement('script');
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Plaid Link script'));
    document.head.appendChild(script);
  });
}

export default function Settings() {
  const api = useApi();
  const { demoUsername, stopDemo } = useDemoAuth();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Email form
  const [email, setEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState(null);

  // Password form
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  // Display name form
  const [displayName, setDisplayName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState(null);

  // Magic link / device login
  const [magicSending, setMagicSending] = useState(false);
  const [magicMsg, setMagicMsg] = useState(null);

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState(null);

  // Data export
  const [exporting, setExporting] = useState(false);

  // Connected banks
  const [banks, setBanks] = useState([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [disconnectTarget, setDisconnectTarget] = useState(null); // { item_id, institution_name }
  const [disconnecting, setDisconnecting] = useState(false);
  const [bankLinking, setBankLinking] = useState(false);
  const [bankLinkError, setBankLinkError] = useState(null);
  const [pendingBankExchange, setPendingBankExchange] = useState(null); // { public_token, institution_name }

  const loadConnections = async () => {
    setBanksLoading(true);
    try {
      const data = await api('/api/plaid/connections');
      setBanks(data.connections || []);
    } catch {
      setBanks([]);
    } finally {
      setBanksLoading(false);
    }
  };

  useEffect(() => {
    api('/api/users/me')
      .then(u => {
        setUser(u);
        setEmail(u?.email || '');
        setDisplayName(u?.name || '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
    loadConnections();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openBankLink = async () => {
    setBankLinking(true);
    setBankLinkError(null);
    setPendingBankExchange(null);
    try {
      await loadPlaidScript();
      const { link_token } = await api('/api/plaid/create-link-token', { method: 'POST' });
      sessionStorage.setItem('plaid_link_token', link_token);
      const handler = window.Plaid.create({
        token: link_token,
        onSuccess: (public_token, metadata) => {
          sessionStorage.removeItem('plaid_link_token');
          setBankLinking(false);
          setPendingBankExchange({ public_token, institution_name: metadata.institution?.name || '' });
        },
        onExit: (err) => {
          if (err) setBankLinkError(err.error_message || 'Plaid Link closed with an error.');
          sessionStorage.removeItem('plaid_link_token');
          setBankLinking(false);
        },
      });
      handler.open();
    } catch (err) {
      setBankLinkError(err.message || 'Could not open bank connection');
      setBankLinking(false);
    }
  };

  const confirmBankExchange = async () => {
    if (!pendingBankExchange) return;
    setBankLinking(true);
    setBankLinkError(null);
    try {
      await api('/api/plaid/exchange-token', {
        method: 'POST',
        body: JSON.stringify(pendingBankExchange),
      });
      setPendingBankExchange(null);
      await loadConnections();
    } catch (err) {
      setBankLinkError(err.message || 'Could not connect bank');
    } finally {
      setBankLinking(false);
    }
  };

  const doDisconnect = async () => {
    if (!disconnectTarget) return;
    setDisconnecting(true);
    try {
      await api(`/api/plaid/connections/${encodeURIComponent(disconnectTarget.item_id)}`, { method: 'DELETE' });
      setDisconnectTarget(null);
      await loadConnections();
    } catch (err) {
      setBankLinkError(err.message || 'Disconnect failed');
      setDisconnectTarget(null);
    } finally {
      setDisconnecting(false);
    }
  };

  const saveName = async e => {
    e.preventDefault();
    setNameMsg(null);
    const trimmed = displayName.trim();
    if (!trimmed) { setNameMsg({ type: 'err', text: 'Display name cannot be empty.' }); return; }
    setNameSaving(true);
    try {
      await api('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify({ name: trimmed }),
      });
      setNameMsg({ type: 'ok', text: 'Display name saved.' });
      setUser(u => ({ ...u, name: trimmed }));
    } catch (err) {
      setNameMsg({ type: 'err', text: err.message });
    } finally {
      setNameSaving(false);
    }
  };

  const saveEmail = async e => {
    e.preventDefault();
    setEmailMsg(null);
    setEmailSaving(true);
    try {
      await api('/api/users/me/email', {
        method: 'PUT',
        body: JSON.stringify({ email: email.trim() }),
      });
      setEmailMsg({ type: 'ok', text: 'Email saved.' });
      setUser(u => ({ ...u, email: email.trim() }));
    } catch (err) {
      setEmailMsg({ type: 'err', text: err.message });
    } finally {
      setEmailSaving(false);
    }
  };

  const savePassword = async e => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'err', text: 'Passwords do not match.' });
      return;
    }
    setPwSaving(true);
    try {
      await api('/api/users/me/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      setPwMsg({ type: 'ok', text: 'Password updated.' });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setUser(u => ({ ...u, has_password: true }));
    } catch (err) {
      setPwMsg({ type: 'err', text: err.message });
    } finally {
      setPwSaving(false);
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      let jwt = '';
      try { jwt = JSON.parse(localStorage.getItem('vt-session') || '{}')?.jwt || ''; } catch {}
      const headers = jwt ? { Authorization: `Bearer ${jwt}` } : {};
      const res = await fetch('/api/account/export', { headers });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vice-tracker-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteText !== 'DELETE') return;
    setDeleting(true);
    setDeleteMsg(null);
    try {
      await api('/api/account', { method: 'DELETE' });
      stopDemo();
    } catch (err) {
      setDeleteMsg({ type: 'err', text: err.message });
      setDeleting(false);
    }
  };

  const sendLoginLink = async () => {
    if (!user?.email) return;
    setMagicMsg(null);
    setMagicSending(true);
    try {
      const res = await fetch('/api/auth/magic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: user.email, purpose: 'login' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || body.error || `Error ${res.status}`);
      setMagicMsg({ type: 'ok', text: body.message || 'Login link sent — check your email.' });
    } catch (err) {
      setMagicMsg({ type: 'err', text: err.message });
    } finally {
      setMagicSending(false);
    }
  };

  if (loading) {
    return (
      <main className="main">
        <div className="skeleton skeleton-card" style={{ height: 120, margin: '32px 0' }} />
      </main>
    );
  }

  const username = user?.auth_username || demoUsername || '—';
  const hasPassword = user?.has_password;

  return (
    <main className="main">
      <div className="crumbs">
        <span>Vice to Value</span>
        <span className="sep">›</span>
        <span className="here">Settings</span>
      </div>
      <div className="page-title">Account Settings</div>

      {/* Account info */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Account</span>
        </div>
        <div style={{ padding: '4px 0 16px' }}>
          <div style={{ marginBottom: 18 }}>
            <div style={s.label}>Username</div>
            <div style={s.readOnly}>{username}</div>
          </div>
          <form onSubmit={saveName} style={{ ...s.form, marginBottom: 20 }}>
            <label style={s.label} htmlFor="st-name">
              Display name <span className="form-hint">— shown to accountability partners</span>
            </label>
            <input
              id="st-name"
              className="form-input"
              type="text"
              value={displayName}
              placeholder="Your display name"
              autoComplete="name"
              maxLength={60}
              onChange={e => { setDisplayName(e.target.value); setNameMsg(null); }}
            />
            <button className="btn btn-primary" type="submit" disabled={nameSaving} style={{ alignSelf: 'flex-start' }}>
              {nameSaving ? 'Saving…' : 'Save name'}
            </button>
            {nameMsg && <Feedback msg={nameMsg} />}
          </form>
          <form onSubmit={saveEmail} style={s.form}>
            <label style={s.label} htmlFor="st-email">
              Email address <span className="form-hint">— for login links and password recovery</span>
            </label>
            <input
              id="st-email"
              className="form-input"
              type="email"
              value={email}
              placeholder="you@example.com"
              autoComplete="email"
              onChange={e => { setEmail(e.target.value); setEmailMsg(null); }}
            />
            <button className="btn btn-primary" type="submit" disabled={emailSaving} style={{ alignSelf: 'flex-start' }}>
              {emailSaving ? 'Saving…' : 'Save email'}
            </button>
            {emailMsg && <Feedback msg={emailMsg} />}
          </form>
        </div>
      </div>

      {/* Connected Banks */}
      <div className="panel">
        <div className="panel-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="panel-title">Connected Banks</span>
          {!pendingBankExchange && (
            <button className="btn" style={{ fontSize: 12 }} onClick={openBankLink} disabled={bankLinking}>
              {bankLinking ? 'Opening…' : '+ Add Bank'}
            </button>
          )}
        </div>

        {bankLinkError && (
          <div style={{ color: 'var(--warn)', fontSize: 13, marginBottom: 12 }}>! {bankLinkError}</div>
        )}

        {pendingBankExchange && (
          <div style={{ marginBottom: 16, padding: '12px 14px', border: '1px solid var(--rule)', borderRadius: 8, background: 'var(--paper-2)' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 14 }}>Confirm bank connection</p>
            <p style={{ margin: '0 0 12px', color: 'var(--ink-3)', fontSize: 13 }}>
              You selected: <strong style={{ color: 'var(--ink)' }}>{pendingBankExchange.institution_name || 'Unknown institution'}</strong>
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={confirmBankExchange} disabled={bankLinking} style={{ fontSize: 13 }}>
                {bankLinking ? 'Connecting…' : 'Yes, connect'}
              </button>
              <button className="btn ghost" onClick={() => setPendingBankExchange(null)} disabled={bankLinking} style={{ fontSize: 13 }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {banksLoading ? (
          <div className="skeleton skeleton-card" style={{ height: 60, marginTop: 8 }} />
        ) : banks.length === 0 ? (
          <p style={{ color: 'var(--ink-3)', fontSize: 13, padding: '8px 0' }}>No banks connected.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 4 }}>
            {banks.map((bank, idx) => (
              <div key={bank.item_id} style={idx < banks.length - 1 ? { borderBottom: '1px solid var(--rule)', paddingBottom: 16 } : {}}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{bank.institution_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                      Connected {new Date(bank.connected_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    className="btn ghost"
                    style={{ fontSize: 12, borderColor: 'var(--warn)', color: 'var(--warn)', flexShrink: 0 }}
                    onClick={() => setDisconnectTarget({ item_id: bank.item_id, institution_name: bank.institution_name })}
                  >
                    Disconnect
                  </button>
                </div>
                {bank.accounts.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {bank.accounts.map(acct => (
                      <div key={acct.account_id} style={{ fontSize: 13, color: 'var(--ink-3)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--ink-2)' }}>{acct.name}</span>
                        <span>{acct.type} · {acct.subtype}{acct.mask ? ` ····${acct.mask}` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Disconnect confirmation modal */}
      {disconnectTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: 'var(--paper, #111)', border: '1px solid var(--rule)', borderRadius: 12,
            padding: 24, maxWidth: 400, width: '100%',
          }}>
            <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, color: 'var(--ink)' }}>
              Disconnect {disconnectTarget.institution_name}?
            </p>
            <p style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
              This will remove all synced transactions from this bank. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-danger" onClick={doDisconnect} disabled={disconnecting}>
                {disconnecting ? 'Disconnecting…' : 'Yes, disconnect'}
              </button>
              <button className="btn ghost" onClick={() => setDisconnectTarget(null)} disabled={disconnecting}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">{hasPassword ? 'Change password' : 'Set a password'}</span>
        </div>
        {!hasPassword && (
          <p style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
            Your account has no password yet. Set one so you can sign in from any device.
          </p>
        )}
        <form onSubmit={savePassword} style={s.form}>
          {hasPassword && (
            <>
              <label style={s.label} htmlFor="st-cur-pw">Current password</label>
              <input id="st-cur-pw" className="form-input" type="password" value={currentPw}
                placeholder="••••••••" autoComplete="current-password" required
                onChange={e => { setCurrentPw(e.target.value); setPwMsg(null); }} />
            </>
          )}
          <label style={s.label} htmlFor="st-new-pw">
            New password <span className="form-hint">— 8+ characters</span>
          </label>
          <input id="st-new-pw" className="form-input" type="password" value={newPw}
            placeholder="••••••••" autoComplete="new-password" required minLength={8}
            onChange={e => { setNewPw(e.target.value); setPwMsg(null); }} />
          <label style={s.label} htmlFor="st-confirm-pw">Confirm new password</label>
          <input id="st-confirm-pw" className="form-input" type="password" value={confirmPw}
            placeholder="••••••••" autoComplete="new-password" required
            onChange={e => { setConfirmPw(e.target.value); setPwMsg(null); }} />
          <button className="btn btn-primary" type="submit" disabled={pwSaving} style={{ alignSelf: 'flex-start' }}>
            {pwSaving ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
          </button>
          {pwMsg && <Feedback msg={pwMsg} />}
        </form>
      </div>

      {/* Log in on another device */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Log in on another device</span>
        </div>
        <p style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
          Sessions are saved per device. On your phone, open the app and sign in with your username <strong style={{ color: 'var(--ink-2)' }}>{username}</strong> and your password.
        </p>
        {user?.email ? (
          <div>
            <p style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
              No password? Send a one-tap login link to <strong style={{ color: 'var(--ink-2)' }}>{user.email}</strong>:
            </p>
            <button className="btn" type="button" onClick={sendLoginLink} disabled={magicSending}>
              {magicSending ? 'Sending…' : 'Email me a login link'}
            </button>
            {magicMsg && <Feedback msg={magicMsg} style={{ marginTop: 10 }} />}
          </div>
        ) : (
          <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>
            Add an email above to enable passwordless login links.
          </p>
        )}
      </div>

      {/* Admin */}
      {String(username || '').trim().toLowerCase() === 'glassonglass' && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Admin</span>
          </div>
          <p style={{ color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
            View the privacy-safe signed-up user list. Only email or connected wallet address is shown.
          </p>
          <a className="btn" href="/admin/users" style={{ display: 'inline-flex', textDecoration: 'none' }}>
            Open user management
          </a>
        </div>
      )}

      {/* Sign out */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Sign out</span>
        </div>
        <div style={{ padding: '4px 0 16px' }}>
          <p style={{ color: 'var(--ink-3)', fontSize: 13, marginBottom: 12 }}>
            Signs you out on this device only. Your data is saved.
          </p>
          <button className="btn btn-danger" type="button" onClick={stopDemo}>
            Sign out
          </button>
        </div>
      </div>

      {/* Export data */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Export my data</span>
        </div>
        <div style={{ padding: '4px 0 16px' }}>
          <p style={{ color: 'var(--ink-3)', fontSize: 13, marginBottom: 12 }}>
            Download all your data — vices, logs, goals, badges, savings, and settings — as a single JSON file.
          </p>
          <button
            className="btn ghost"
            type="button"
            disabled={exporting}
            onClick={exportData}
          >
            {exporting ? 'Preparing…' : 'Download JSON export'}
          </button>
        </div>
      </div>

      {/* Delete account */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Delete account</span>
        </div>
        <div style={{ padding: '4px 0 16px' }}>
          {!deleteConfirm ? (
            <>
              <p style={{ color: 'var(--ink-3)', fontSize: 13, marginBottom: 12 }}>
                Permanently deletes your account and all data — vices, entries, savings, goals, and partner connections. This cannot be undone.
              </p>
              <button
                className="btn ghost"
                type="button"
                style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }}
                onClick={() => setDeleteConfirm(true)}
              >
                Delete my account
              </button>
            </>
          ) : (
            <>
              <p style={{ color: 'var(--warn)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                This is permanent and cannot be undone. All your vices, logs, goals, badges, and partner connections will be deleted.
              </p>
              <label style={{ ...s.label, marginBottom: 4 }} htmlFor="del-confirm-text">
                Type <strong>DELETE</strong> to confirm
              </label>
              <input
                id="del-confirm-text"
                className="form-input"
                value={deleteText}
                placeholder="DELETE"
                autoComplete="off"
                maxLength={10}
                style={{ maxWidth: 200, marginBottom: 12 }}
                onChange={e => setDeleteText(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-danger"
                  type="button"
                  disabled={deleting || deleteText !== 'DELETE'}
                  onClick={deleteAccount}
                >
                  {deleting ? 'Deleting…' : 'Delete my account'}
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  disabled={deleting}
                  onClick={() => { setDeleteConfirm(false); setDeleteText(''); setDeleteMsg(null); }}
                >
                  Cancel
                </button>
              </div>
              {deleteMsg && <Feedback msg={deleteMsg} style={{ marginTop: 10 }} />}
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid var(--rule)', display: 'flex', gap: 12, alignItems: 'center' }}>
        <a href="/privacy" style={{ fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none' }}>Privacy Policy</a>
        <span style={{ color: 'var(--ink-3)', opacity: 0.5 }}>·</span>
        <a href="/terms" style={{ fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none' }}>Terms of Service</a>
      </div>
    </main>
  );
}

function Feedback({ msg, style: extraStyle }) {
  if (!msg) return null;
  const isOk = msg.type === 'ok';
  return (
    <div style={{
      fontSize: 13,
      marginTop: 6,
      color: isOk ? 'var(--money, #5ec48a)' : 'var(--warn)',
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      ...extraStyle,
    }}>
      {isOk ? '✓' : '!'} {msg.text}
    </div>
  );
}

const s = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    maxWidth: 380,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--ink-2)',
  },
  readOnly: {
    fontSize: 15,
    color: 'var(--ink)',
    padding: '9px 12px',
    background: 'var(--paper-2)',
    border: '1px solid var(--rule)',
    borderRadius: 8,
    maxWidth: 380,
    fontFamily: 'var(--mono, monospace)',
    letterSpacing: '0.01em',
  },
};
