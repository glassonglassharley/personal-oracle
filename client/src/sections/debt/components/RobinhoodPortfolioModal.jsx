const DEMO_POSITIONS = [
  { ticker: 'AAPL', value: 450, costBasis: 380, held: 'long' },
  { ticker: 'NVDA', value: 620, costBasis: 490, held: 'short' },
  { ticker: 'SPY',  value: 310, costBasis: 295, held: 'long' },
]

const DEMO_CASH = 1243.50
const DEMO_BUYING_POWER = 2186.00

export default function RobinhoodPortfolioModal({ onClose, status }) {
  const isActive = status === 'active'
  const positions = isActive ? [] : DEMO_POSITIONS

  const totalValue    = positions.reduce((s, p) => s + p.value, 0)
  const totalCost     = positions.reduce((s, p) => s + p.costBasis, 0)
  const totalGain     = totalValue - totalCost
  const cashBalance   = isActive ? 0 : DEMO_CASH
  const buyingPower   = isActive ? 0 : DEMO_BUYING_POWER

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card rh-modal-card">
        <div className="modal-eyebrow">// ROBINHOOD AGENTIC</div>
        <div className="rh-modal-title">PORTFOLIO INTEL</div>
        <div className="rh-modal-sub">ROBINHOOD AGENTIC ACCOUNT</div>

        {!isActive && (
          <div className="rh-demo-banner">// DEMO DATA — AWAITING AGENTIC ACCESS</div>
        )}

        <div className="rh-pending-block">
          <div className="rh-pending-label">// AWAITING AGENTIC ACCESS</div>
          <div className="rh-pending-status">WAITLIST STATUS: PENDING</div>
          <div className="rh-pending-note">
            Full trading access coming soon. Portfolio reading available once account is activated.
          </div>
        </div>

        <div className="rh-account-stats">
          <div className="rh-stat-row">
            <span className="rh-stat-label">CASH BALANCE</span>
            <span className="rh-stat-val">${cashBalance.toFixed(2)}</span>
          </div>
          <div className="rh-stat-row">
            <span className="rh-stat-label">PORTFOLIO VALUE</span>
            <span className="rh-stat-val">${totalValue.toFixed(2)}</span>
          </div>
          <div className="rh-stat-row">
            <span className="rh-stat-label">BUYING POWER</span>
            <span className="rh-stat-val rh-gold">${buyingPower.toFixed(2)}</span>
          </div>
        </div>

        <div className="rh-positions-header">POSITIONS</div>
        <div className="rh-positions-list">
          {positions.map(pos => {
            const gain    = pos.value - pos.costBasis
            const gainPct = (gain / pos.costBasis) * 100
            const isUp    = gain >= 0
            return (
              <div key={pos.ticker} className="rh-position-row">
                <div className="rh-position-left">
                  <span className="rh-ticker">{pos.ticker}</span>
                  <span className="rh-held-label">{pos.held === 'long' ? 'LONG TERM' : 'SHORT TERM'}</span>
                </div>
                <div className="rh-position-right">
                  <span className="rh-pos-value">${pos.value.toFixed(2)}</span>
                  <span className="rh-pos-basis">COST ${pos.costBasis.toFixed(2)}</span>
                  <span className={`rh-pos-gain ${isUp ? 'gain-up' : 'gain-down'}`}>
                    {isUp ? '+' : ''}{gain.toFixed(2)} ({isUp ? '+' : ''}{gainPct.toFixed(1)}%)
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="rh-total-gain-row">
          <span className="rh-stat-label">TOTAL UNREALIZED GAINS</span>
          <span className="rh-stat-val rh-gold">
            {totalGain >= 0 ? '+' : ''}${totalGain.toFixed(2)}
          </span>
        </div>

        <div className="rh-last-updated">
          LAST UPDATED: {new Date().toLocaleString()}
        </div>

        <div className="modal-actions">
          <button className="btn-abort" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  )
}
