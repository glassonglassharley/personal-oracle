import { useState } from 'react'

export default function SyncScoreModal({ currentScore, onSync, onClose }) {
  const [score, setScore] = useState(String(currentScore))

  const resolvedScore = Math.max(300, Math.min(850, parseInt(score, 10) || 0))
  const valid = resolvedScore >= 300 && resolvedScore <= 850

  const handleSync = () => {
    if (!valid) return
    onSync(resolvedScore)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card sync-score-card">
        <div className="modal-eyebrow">// CREDIT KARMA MANUAL SYNC</div>
        <div className="modal-lender">GRID INTEGRITY BASELINE</div>
        <div className="sync-score-copy">
          Enter the latest score you see in Credit Karma. Debt Assassination will handle day-to-day Grid Integrity locally after that.
        </div>

        <div className="modal-field">
          <label className="modal-field-label">BASE CREDIT SCORE</label>
          <input
            className="modal-input sync-score-input"
            type="number"
            min="300"
            max="850"
            value={score}
            onChange={e => setScore(e.target.value)}
            autoFocus
          />
        </div>

        <div className="modal-confirm">
          {valid ? (
            <>New baseline: <span className="hl">{resolvedScore}</span></>
          ) : (
            <>Enter a score from 300 to 850</>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-abort" onClick={onClose}>ABORT</button>
          <button className="btn-modal-execute" onClick={handleSync} disabled={!valid}>
            SYNC
          </button>
        </div>
      </div>
    </div>
  )
}
