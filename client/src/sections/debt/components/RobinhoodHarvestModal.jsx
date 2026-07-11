import { useState } from 'react'

const DEMO_POSITIONS = [
  { ticker: 'AAPL', value: 450, costBasis: 380, held: 'long' },
  { ticker: 'NVDA', value: 620, costBasis: 490, held: 'short' },
  { ticker: 'SPY',  value: 310, costBasis: 295, held: 'long' },
]

function getHarvestTier(gainPct) {
  if (gainPct >= 50) return 'FULL EXECUTION'
  if (gainPct >= 20) return 'STRONG HARVEST'
  if (gainPct >= 10) return 'HARVEST CANDIDATE'
  return null
}

export default function RobinhoodHarvestModal({ onClose, status, activeTarget, onLogHarvest, splitPref, onSaveSplit }) {
  const isActive = status === 'active'
  const positions = isActive ? [] : DEMO_POSITIONS

  // Split calculator — debt is the free lever; reinvest auto-fills
  const [debtPct,     setDebtPctRaw]     = useState(splitPref?.debt     ?? 50)
  const [taxPct,      setTaxPctRaw]      = useState(splitPref?.tax      ?? 30)
  const [splitInput,  setSplitInput]     = useState('')
  const [confirming,  setConfirming]     = useState(null) // ticker string

  const reinvestPct  = Math.max(0, 100 - debtPct - taxPct)
  const splitOk      = debtPct + taxPct <= 100

  function setDebtPct(v) { setDebtPctRaw(Math.min(100, Math.max(0, Number(v)))) }
  function setTaxPct(v)  { setTaxPctRaw(Math.min(100 - debtPct, Math.max(0, Number(v)))) }

  const splitAmount   = parseFloat(splitInput) || 0
  const debtAmount    = splitAmount * debtPct   / 100
  const taxAmount     = splitAmount * taxPct    / 100
  const reinvestAmount = splitAmount * reinvestPct / 100

  const candidates = positions
    .map(p => {
      const gain    = p.value - p.costBasis
      const gainPct = (gain / p.costBasis) * 100
      const tier    = getHarvestTier(gainPct)
      return { ...p, gain, gainPct, tier }
    })
    .filter(p => p.tier)
    .sort((a, b) => b.gainPct - a.gainPct)

  function handleLogHarvest(pos) {
    const harvestAmt = pos.value * 0.25
    onLogHarvest?.(pos.ticker, harvestAmt, activeTarget)
    setConfirming(null)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card rh-modal-card">
        <div className="modal-eyebrow">// PROFIT EXTRACTION ENGINE</div>
        <div className="rh-modal-title">HARVEST INTEL</div>
        <div className="rh-modal-sub">PROFIT EXTRACTION TARGETS</div>

        {!isActive && (
          <div className="rh-demo-banner">// DEMO DATA — AWAITING AGENTIC ACCESS</div>
        )}

        {/* ── Harley DeFi Split Calculator ── */}
        <div className="hd-split-calc">
          <div className="hd-split-header">HARLEY DEFI SPLIT</div>

          <div className="hd-split-input-row">
            <span className="hd-split-input-label">HARVEST AMOUNT</span>
            <input
              className="hd-split-input"
              type="number"
              placeholder="$0.00"
              value={splitInput}
              onChange={e => setSplitInput(e.target.value)}
            />
          </div>

          <div className="hd-split-table">
            <div className="hd-split-row">
              <span className="hd-split-pct">{debtPct}%</span>
              <span className="hd-split-name">→ DEBT ASSASSINATION</span>
              <span className="hd-split-amt">${debtAmount.toFixed(2)}</span>
            </div>
            <div className="hd-split-row">
              <span className="hd-split-pct">{taxPct}%</span>
              <span className="hd-split-name">→ TAX RESERVE</span>
              <span className="hd-split-amt">${taxAmount.toFixed(2)}</span>
            </div>
            <div className="hd-split-row">
              <span className="hd-split-pct">{reinvestPct}%</span>
              <span className="hd-split-name">→ REINVEST</span>
              <span className="hd-split-amt">${reinvestAmount.toFixed(2)}</span>
            </div>
            <div className="hd-split-divider" />
            <div className="hd-split-row hd-split-total-row">
              <span className="hd-split-pct">100%</span>
              <span className="hd-split-name">TOTAL</span>
              <span className="hd-split-amt">${splitAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="hd-sliders">
            <div className="hd-slider-row">
              <span className="hd-slider-label">DEBT {debtPct}%</span>
              <input type="range" min="0" max="100" value={debtPct}
                onChange={e => setDebtPct(e.target.value)} className="hd-slider" />
            </div>
            <div className="hd-slider-row">
              <span className="hd-slider-label">TAX {taxPct}%</span>
              <input type="range" min="0" max={100 - debtPct} value={taxPct}
                onChange={e => setTaxPct(e.target.value)} className="hd-slider" />
            </div>
            <div className="hd-slider-row hd-slider-computed">
              <span className="hd-slider-label">REINVEST {reinvestPct}% <span className="hd-auto-label">(AUTO)</span></span>
              <input type="range" min="0" max="100" value={reinvestPct} readOnly className="hd-slider hd-slider-readonly" />
            </div>
          </div>

          {splitOk && (
            <button className="hd-save-btn" onClick={() => onSaveSplit?.({ debt: debtPct, tax: taxPct, reinvest: reinvestPct })}>
              SAVE SPLIT PREFERENCE
            </button>
          )}
        </div>

        {/* ── Harvest Candidates ── */}
        <div className="rh-candidates-header">HARVEST CANDIDATES</div>

        {candidates.length === 0 ? (
          <div className="rh-no-candidates">NO POSITIONS ABOVE 10% GAIN THRESHOLD</div>
        ) : (
          candidates.map(pos => {
            const harvestAmt   = pos.value * 0.25
            const grossGain    = pos.gain * 0.25
            const stTax        = grossGain * 0.22
            const ltTax        = grossGain * 0.15
            const stAfter      = harvestAmt - stTax
            const ltAfter      = harvestAmt - ltTax
            const taxReserve   = harvestAmt * 0.30
            const reinvestAmt  = harvestAmt * 0.20
            const debtAmt      = harvestAmt * 0.50
            const newBalance   = activeTarget ? Math.max(0, activeTarget.balance - debtAmt) : null
            const isStrongPlus = pos.gainPct >= 20

            return (
              <div key={pos.ticker} className="rh-harvest-item">
                <div className="rh-harvest-top">
                  <span className="rh-harvest-ticker">{pos.ticker}</span>
                  <span className={`rh-harvest-tier-badge ${isStrongPlus ? 'tier-gold' : 'tier-candidate'}`}>
                    {pos.tier}
                  </span>
                </div>

                <div className="rh-harvest-gain-line" style={{ color: isStrongPlus ? 'var(--gold)' : 'var(--red)' }}>
                  +{pos.gainPct.toFixed(1)}% GAIN · {pos.held === 'long' ? 'LONG TERM' : 'SHORT TERM'}
                </div>

                <div className="rh-harvest-section-lbl">RECOMMENDED HARVEST (25% of position)</div>
                <div className="rh-harvest-stat"><span className="rh-hs-label">HARVEST AMOUNT</span><span className="rh-hs-val">${harvestAmt.toFixed(2)}</span></div>

                <div className="rh-harvest-section-lbl">AFTER-TAX ESTIMATE</div>
                <div className="rh-harvest-stat"><span className="rh-hs-label">SHORT TERM (&lt;1yr · 22%)</span><span className="rh-hs-val">${stAfter.toFixed(2)}</span></div>
                <div className="rh-harvest-stat"><span className="rh-hs-label">LONG TERM (&gt;1yr · 15%)</span><span className="rh-hs-val">${ltAfter.toFixed(2)}</span></div>

                {activeTarget && (
                  <>
                    <div className="rh-harvest-section-lbl">DEBT ROUTING</div>
                    <div className="rh-harvest-stat"><span className="rh-hs-label">TARGET</span><span className="rh-hs-val">{activeTarget.lender}</span></div>
                    <div className="rh-harvest-stat"><span className="rh-hs-label">ROUTE ${debtAmt.toFixed(2)} → NEW BALANCE</span><span className="rh-hs-val">${newBalance.toFixed(2)}</span></div>
                  </>
                )}

                <div className="rh-harvest-reserves">
                  <div className="rh-reserve-item">
                    <span className="rh-reserve-lbl">SET ASIDE FOR TAXES (30%)</span>
                    <span className="rh-reserve-val">${taxReserve.toFixed(2)}</span>
                  </div>
                  <div className="rh-reserve-item">
                    <span className="rh-reserve-lbl">KEEP IN ACCOUNT (20%)</span>
                    <span className="rh-reserve-val">${reinvestAmt.toFixed(2)}</span>
                  </div>
                </div>

                {confirming === pos.ticker ? (
                  <div className="rh-harvest-confirm">
                    <div className="rh-confirm-msg">
                      Transfer ${harvestAmt.toFixed(2)} from Robinhood to your bank, then let autopay handle the credit card payment. Come back and hit SYNC AFTER PAYMENT when done.
                    </div>
                    <div className="rh-confirm-actions">
                      <button className="btn-abort" onClick={() => setConfirming(null)}>CANCEL</button>
                      <button className="btn-modal-execute" onClick={() => handleLogHarvest(pos)}>LOG IT</button>
                    </div>
                  </div>
                ) : (
                  <button className="rh-execute-btn" onClick={() => setConfirming(pos.ticker)}>
                    MANUAL HARVEST — LOG IT
                  </button>
                )}
              </div>
            )
          })
        )}

        <div className="modal-actions">
          <button className="btn-abort" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  )
}
