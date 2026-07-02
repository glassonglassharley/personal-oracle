import { useState } from 'react'

export default function AutopayCalendarModal({ onClose, debts, onUpdateDueDay, autopayThreshold, onSetThreshold }) {
  const [thresholdInput, setThresholdInput] = useState(autopayThreshold != null ? String(autopayThreshold) : '')

  const today       = new Date()
  const currentDay  = today.getDate()
  const autopayDebts = debts.filter(d => d.autopayEnabled && d.autopayAmount && d.balance > 0)
  const totalAutopay = autopayDebts.reduce((s, d) => s + (d.autopayAmount || 0), 0)

  function getDaysUntil(dueDay) {
    if (!dueDay) return null
    let days = dueDay - currentDay
    if (days < 0) {
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
      days = daysInMonth - currentDay + dueDay
    }
    return days
  }

  function getDayColor(days) {
    if (days === null) return 'var(--muted)'
    if (days <= 5)  return 'var(--red)'
    if (days <= 14) return 'var(--gold)'
    return 'var(--muted)'
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card rh-modal-card">
        <div className="modal-eyebrow">// PAYMENT TIMING INTEL</div>
        <div className="rh-modal-title">AUTOPAY CALENDAR</div>
        <div className="rh-modal-sub">WHEN MONEY NEEDS TO LAND</div>

        {autopayDebts.length === 0 ? (
          <div className="rh-no-candidates">
            NO AUTOPAY ENABLED<br />
            <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
              Enable autopay on debt cards to track payment timing.
            </span>
          </div>
        ) : (
          <>
            <div className="autopay-cal-list">
              {autopayDebts.map(d => {
                const days = getDaysUntil(d.autopayDueDay)
                return (
                  <div key={d.id} className="autopay-cal-row">
                    <div className="autopay-cal-left">
                      <div className="autopay-cal-name">{d.lender}</div>
                      <div className="autopay-cal-amount">AUTO ${(d.autopayAmount || 0).toFixed(2)}/MO</div>
                    </div>
                    <div className="autopay-cal-right">
                      <div className="autopay-cal-due-wrap">
                        <span className="autopay-cal-due-lbl">DUE DAY</span>
                        <input
                          className="autopay-due-input"
                          type="number"
                          min="1"
                          max="31"
                          placeholder="--"
                          value={d.autopayDueDay || ''}
                          onChange={e => onUpdateDueDay?.(d.id, e.target.value ? parseInt(e.target.value) : null)}
                        />
                      </div>
                      {days !== null && (
                        <div className="autopay-days-until" style={{ color: getDayColor(days) }}>
                          {days === 0 ? 'DUE TODAY' : `${days} DAYS`}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="autopay-cal-total-row">
              <span className="autopay-cal-total-lbl">TOTAL AUTOPAY COMMITTED</span>
              <span className="autopay-cal-total-val">${totalAutopay.toFixed(2)}/MO</span>
            </div>

            <div className="autopay-threshold-row">
              <span className="autopay-cal-due-lbl">MONTHLY BUDGET THRESHOLD ($)</span>
              <input
                className="autopay-due-input"
                type="number"
                placeholder="set limit"
                value={thresholdInput}
                onChange={e => setThresholdInput(e.target.value)}
                onBlur={() => onSetThreshold?.(thresholdInput ? parseFloat(thresholdInput) : null)}
              />
            </div>

            {autopayThreshold && totalAutopay > autopayThreshold && (
              <div className="autopay-threshold-warning">
                ⚠ TOTAL AUTOPAY ${totalAutopay.toFixed(2)} EXCEEDS BUDGET ${autopayThreshold.toFixed(2)}
              </div>
            )}
          </>
        )}

        <div className="modal-actions">
          <button className="btn-abort" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  )
}
