import { useState, useRef, useEffect } from 'react'
import { usePlaidLink } from 'react-plaid-link'

const FAQ = [
  {
    category: 'STRATEGY',
    items: [
      { term: 'ACTIVE TARGET', def: 'The card with the lowest remaining balance. Throw every extra dollar at this one card while paying minimums on all others. Eliminating it frees up its minimum payment as a weapon.' },
      { term: 'SNOWBALL METHOD', def: "When the active target hits $0, redirect its freed minimum to the next lowest balance. Each kill makes your monthly attack power bigger. The debt cannot recover." },
      { term: 'PHASE 1 / 2 / 3', def: 'Threat tier based on balance. Phase 1: $0–$250 (street-level). Phase 2: $251–$750 (pressure accounts). Phase 3: $751+ (heavy systems). Final Boss is Phase 3.' },
      { term: 'FREED MINIMUM', def: "When a card is eliminated, its required minimum payment is permanently freed. This snowballs into the next target — shown as SNOWBALL FREED in the dashboard header." },
    ],
  },
  {
    category: 'CREDIT SCORE',
    items: [
      { term: 'GRID INTEGRITY', def: 'Your estimated credit score based on your actual credit score, payments made, cards eliminated, and utilization penalties. Improves automatically as you pay down debt.' },
      { term: 'CLEARANCE TIER', def: 'Your rank earned through Grid Integrity. INITIATE (300+) → RUNNER (640+) → OPERATOR (700+) → SPECTER (760+) → ARCHITECT (800+). Each tier represents real creditworthiness.' },
      { term: 'PROJECTED SCORE', def: 'Estimated Grid Integrity if you paid off all remaining debt today. Shows the maximum score you could reach — your final unlocked tier.' },
      { term: 'UTILIZATION', def: 'Balance ÷ credit limit, expressed as a %. Accounts for ~30% of your credit score. Keep each card below 30% to avoid score penalties. Under 10% is ideal.' },
    ],
  },
  {
    category: 'COSTS & INTEREST',
    items: [
      { term: 'APR', def: 'Annual Percentage Rate. The yearly interest rate charged on your balance. A 24.99% APR on $1,000 costs ~$0.68 every single day you carry it.' },
      { term: 'DAILY INTEREST', def: "Formula: (APR ÷ 100 ÷ 365) × balance. This is real money extracted from you every day you don't pay it off. Set APR on each card to see the actual daily cost." },
      { term: 'BLEEDING/DAY', def: 'Total daily interest summed across all active cards with APR entered. This number runs 24/7. Every payment you make reduces it permanently.' },
      { term: 'MIN PAYMENT', def: 'The required minimum monthly payment on a card. Paying only the minimum is a trap — most of it goes to interest. Enter it to track snowball freed amounts.' },
    ],
  },
  {
    category: 'CARD STATUS',
    items: [
      { term: 'OVERLIMIT / BREACH', def: 'Balance exceeds the credit limit. Triggers RAGING status, destroys your utilization score, and often triggers over-limit fees. Eliminate or pay below the limit immediately.' },
      { term: 'RAGING', def: 'A card that is over its credit limit. Highest threat priority. In Battle Mode the villain enters an enraged state. Real consequence: over-limit fees + severe credit score damage.' },
      { term: 'COUNTERATTACK', def: "A late fee or interest charge that adds to a card's balance. Triggered when a minimum payment is missed or a billing cycle closes while over-limit. The enemy strikes back." },
      { term: 'ELIMINATED', def: 'Card balance reduced to $0. The enemy is permanently removed from the active threat list. Its minimum payment is freed for the snowball.' },
    ],
  },
  {
    category: 'BATTLE MODE',
    items: [
      { term: 'WAVE', def: 'A group of enemies sorted by Phase. Wave 01 = Phase 1 (low-balance threats). Wave 02 = Phase 2 (mid-tier). Final Wave = Phase 3 heavy systems including the Final Boss.' },
      { term: 'HP (HEALTH POINTS)', def: "A villain's remaining balance shown as a health bar. Deal damage (make payments) to drain it to zero. When HP hits 0, the enemy is eliminated." },
      { term: 'SHIELD', def: 'Credit headroom: (limit − balance) ÷ limit × 100%. Represents how far you are from breaching the limit. Shield breaks at 0% — card enters RAGING state.' },
      { term: 'DAMAGE / DAILY DAMAGE', def: 'Daily interest expressed as enemy attack power: (APR ÷ 365 ÷ 100) × balance. Enemies with APR passively drain your financial health every day.' },
      { term: 'FINAL BOSS', def: 'The highest-balance card (Apple Card). Confronted only after clearing earlier waves. Has phase stages: ENRAGED (>$1,500), DESPERATE ($501–$1,500), FINAL STAND (≤$500).' },
      { term: 'LOOT DROP', def: 'When an enemy is eliminated, its minimum payment drops as a loot item. That cash is now yours to redirect to the next target every month.' },
    ],
  },
]

export default function HamburgerMenu({ addToast, onImport, onShowIntro, plaid, robinhoodStatus, totalAutopayCommitted, onReadPortfolio, onHarvestOpportunities, onShowAutopayCalendar }) {
  const [open, setOpen] = useState(false)
  const [pasteVal, setPasteVal] = useState('')
  const [connecting, setConnecting] = useState(false)
  const fileInputRef = useRef(null)

  const close = () => setOpen(false)

  const { open: openLink, ready } = usePlaidLink({
    token: plaid?.linkToken ?? null,
    onSuccess: (publicToken) => plaid?.onLinkSuccess(publicToken),
  })

  useEffect(() => {
    if (ready && connecting) {
      openLink()
      setConnecting(false)
    }
  }, [ready, connecting, openLink])

  async function handleConnect() {
    setConnecting(true)
    const token = await plaid?.fetchLinkToken()
    if (!token) setConnecting(false)
  }

  async function handleSync() {
    await plaid?.syncBalances({ silent: false })
  }

  function handleExport() {
    try {
      const raw = localStorage.getItem('debt-assassination-v1')
      if (!raw) { addToast?.('NO DATA TO EXPORT', 'red'); return }
      const date = new Date().toISOString().slice(0, 10)
      const blob = new Blob([raw], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `debt-assassination-backup-${date}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      addToast?.('BACKUP SAVED — KEEP THIS FILE SAFE', 'gold')
    } catch { addToast?.('EXPORT FAILED', 'red') }
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result)
        if (!Array.isArray(json.debts)) { addToast?.('INVALID FILE — BACKUP NOT RESTORED', 'red'); return }
        if (!window.confirm('This will overwrite all current progress. Continue?')) return
        const ok = onImport?.(ev.target.result)
        if (ok) addToast?.('DATA RESTORED SUCCESSFULLY', 'gold')
        else addToast?.('INVALID FILE — BACKUP NOT RESTORED', 'red')
      } catch { addToast?.('INVALID FILE — BACKUP NOT RESTORED', 'red') }
    }
    reader.readAsText(file)
  }

  async function handleCopyState() {
    try {
      const raw = localStorage.getItem('debt-assassination-v1')
      if (!raw) { addToast?.('NO DATA TO COPY', 'red'); return }
      const encoded = btoa(encodeURIComponent(raw))
      await navigator.clipboard.writeText(encoded)
      addToast?.('STATE COPIED TO CLIPBOARD', 'gold')
    } catch { addToast?.('CLIPBOARD ACCESS DENIED', 'red') }
  }

  function handlePasteRestore() {
    if (!pasteVal.trim()) return
    try {
      const raw = decodeURIComponent(atob(pasteVal.trim()))
      const json = JSON.parse(raw)
      if (!Array.isArray(json.debts)) { addToast?.('INVALID DATA — NOT RESTORED', 'red'); return }
      if (!window.confirm('This will overwrite all current progress. Continue?')) return
      const ok = onImport?.(raw)
      if (ok) { addToast?.('DATA RESTORED SUCCESSFULLY', 'gold'); setPasteVal('') }
      else addToast?.('INVALID DATA — NOT RESTORED', 'red')
    } catch { addToast?.('INVALID DATA — NOT RESTORED', 'red') }
  }

  return (
    <>
      <button
        className={`hamburger-btn ${open ? 'hb-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
      >
        <span className="hb-line" />
        <span className="hb-line" />
        <span className="hb-line" />
      </button>

      {open && <div className="menu-backdrop" onClick={close} aria-hidden="true" />}

      <nav className={`side-drawer ${open ? 'drawer-open' : ''}`} aria-label="Side menu">
        <div className="drawer-header">
          <span className="drawer-eyebrow">// SYSTEM MENU</span>
          <button className="drawer-close" onClick={close} aria-label="Close menu">✕</button>
        </div>

        <div className="faq-list">
          {/* Plaid bank sync section */}
          <div className="faq-section">
            <div className="faq-category">BANK SYNC</div>
            <div className="drawer-data-section">
              {!plaid?.isConnected ? (
                <>
                  <button
                    className="drawer-data-btn plaid-connect-btn"
                    onClick={handleConnect}
                    disabled={connecting}
                  >
                    {connecting ? '⟳ INITIALIZING...' : '⬡ CONNECT ACCOUNTS'}
                  </button>
                  <p className="drawer-data-hint">Link your bank via Plaid to auto-sync card balances.</p>
                </>
              ) : (
                <>
                  <button
                    className="drawer-data-btn plaid-sync-btn"
                    onClick={handleSync}
                    disabled={plaid?.isSyncing}
                  >
                    {plaid?.isSyncing ? '⟳ SYNCING...' : '⟳ SYNC BALANCES'}
                  </button>
                  {plaid?.lastSyncLabel && (
                    <p className={`drawer-data-hint plaid-sync-ts ${plaid?.syncOverdue ? 'sync-overdue' : ''}`}>
                      LAST SYNC: {plaid.lastSyncLabel}{plaid?.syncOverdue ? ' — OVERDUE' : ''}
                    </p>
                  )}
                  <button
                    className="drawer-data-btn plaid-disconnect-btn"
                    onClick={() => plaid?.disconnect()}
                  >
                    ✕ DISCONNECT ACCOUNTS
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Robinhood Agent section */}
          <div className="faq-section">
            <div className="rh-section-header">
              <span className="rh-section-title">⚡ ROBINHOOD AGENT</span>
              <span className="rh-section-sub">AGENTIC TRADING — BETA</span>
            </div>
            <div className="rh-status-pill-wrap">
              <span className={`rh-status-pill ${robinhoodStatus === 'active' ? 'rh-pill-active' : ''}`}>
                AGENTIC ACCESS: {robinhoodStatus === 'active' ? 'ACTIVE' : 'PENDING'}
              </span>
            </div>
            <div className="drawer-data-section">
              <button className="drawer-data-btn rh-read-btn" onClick={() => { close(); onReadPortfolio?.() }}>
                READ PORTFOLIO
              </button>
              <button className="drawer-data-btn rh-harvest-btn" onClick={() => { close(); onHarvestOpportunities?.() }}>
                HARVEST OPPORTUNITIES
              </button>
              <button
                className="drawer-data-btn muted-btn"
                onClick={handleSync}
                disabled={plaid?.isSyncing || !plaid?.isConnected}
              >
                {plaid?.isSyncing ? '⟳ SYNCING...' : '⟳ SYNC AFTER PAYMENT'}
              </button>
              <p className="drawer-data-hint">Use after autopay pulls to update balances.</p>
            </div>
          </div>

          {/* Autopay Calendar section */}
          <div className="faq-section">
            <div className="faq-category">AUTOPAY CALENDAR</div>
            <div className="drawer-data-section">
              {totalAutopayCommitted > 0 && (
                <div className="autopay-committed-label">TOTAL COMMITTED: ${totalAutopayCommitted.toFixed(2)}/MO</div>
              )}
              <button className="drawer-data-btn muted-btn" onClick={() => { close(); onShowAutopayCalendar?.() }}>
                ◈ VIEW AUTOPAY SCHEDULE
              </button>
              <p className="drawer-data-hint">Track when money needs to land before autopay pulls.</p>
            </div>
          </div>

          {/* Data backup section */}
          <div className="faq-section">
            <div className="faq-category">DATA BACKUP</div>

            <div className="drawer-data-section">
              <button className="drawer-data-btn gold-btn" onClick={handleExport}>
                ↓ EXPORT DATA
              </button>
              <p className="drawer-data-hint">Downloads a .json backup file of all your progress.</p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleImportFile}
              />
              <button className="drawer-data-btn muted-btn" onClick={() => fileInputRef.current?.click()}>
                ↑ IMPORT DATA
              </button>
              <p className="drawer-data-hint">Restore from a backup file. Will overwrite current data.</p>

              <div className="drawer-divider" />

              <button className="drawer-data-btn muted-btn" onClick={handleCopyState}>
                ⧉ COPY STATE TO CLIPBOARD
              </button>
              <p className="drawer-data-hint">Copies encoded state string — paste into Notes or email to yourself.</p>

              <div className="drawer-paste-row">
                <input
                  className="drawer-paste-input"
                  type="text"
                  placeholder="PASTE STATE STRING HERE"
                  value={pasteVal}
                  onChange={e => setPasteVal(e.target.value)}
                />
                <button className="drawer-paste-btn" onClick={handlePasteRestore} disabled={!pasteVal.trim()}>
                  RESTORE
                </button>
              </div>
            </div>
          </div>

          {/* Navigation section */}
          <div className="faq-section">
            <div className="faq-category">NAVIGATION</div>
            <div className="drawer-data-section">
              <button className="drawer-data-btn muted-btn" onClick={() => { close(); onShowIntro?.() }}>
                ▶ SHOW INTRO
              </button>
              <p className="drawer-data-hint">Replay the welcome mission briefing.</p>
            </div>
          </div>

          {/* FAQ */}
          <div className="drawer-section-title">FIELD MANUAL</div>
          <p className="drawer-intro">All terms, mechanics, and formulas used in this system.</p>

          {FAQ.map(section => (
            <div key={section.category} className="faq-section">
              <div className="faq-category">{section.category}</div>
              {section.items.map(item => (
                <div key={item.term} className="faq-item">
                  <div className="faq-term">{item.term}</div>
                  <div className="faq-def">{item.def}</div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="drawer-footer">
          DEBT ASSASSINATION · FINANCIAL LIBERATION PROTOCOL
        </div>
      </nav>
    </>
  )
}
