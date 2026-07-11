import { useState } from 'react'

const PRESETS = [15, 20, 25, 29.99]

export default function AprModal({ debt, onSave, onClose }) {
  const [val, setVal] = useState(debt.apr != null ? String(debt.apr) : '')

  const apr = parseFloat(val) || 0
  const dailyInterest = apr > 0 && debt.balance > 0
    ? ((apr / 100) / 365) * debt.balance
    : null

  const handleSave = () => {
    onSave(debt.id, val)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-eyebrow">// APR CONFIGURATION</div>
        <div className="apr-modal-title">SET APR</div>
        <div className="apr-modal-subtitle">{debt.lender}</div>

        <div className="quick-grid">
          {PRESETS.map(p => (
            <button
              key={p}
              className={`quick-btn ${parseFloat(val) === p ? 'selected' : ''}`}
              onClick={() => setVal(String(p))}
            >
              {p}%
            </button>
          ))}
        </div>

        <div className="modal-field">
          <label className="modal-field-label">ANNUAL PERCENTAGE RATE</label>
          <input
            className="modal-input apr-input"
            type="number"
            min="0"
            step="0.01"
            placeholder="ENTER APR % (e.g. 24.99)"
            value={val}
            onChange={e => setVal(e.target.value)}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
        </div>

        <div className="modal-confirm">
          {dailyInterest !== null ? (
            <>DAILY INTEREST: <span className="hl">${dailyInterest.toFixed(2)}/day</span></>
          ) : (
            <>&nbsp;</>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-abort" onClick={onClose}>CANCEL</button>
          <button className="btn-modal-execute" onClick={handleSave}>
            SAVE APR
          </button>
        </div>
      </div>
    </div>
  )
}
