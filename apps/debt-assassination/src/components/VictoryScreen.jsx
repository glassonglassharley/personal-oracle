import { TOTAL_ORIGINAL_DEBT } from '../constants'

export default function VictoryScreen({ totalPaid, onClose }) {
  const skulls = Array.from({ length: 12 }, (_, i) => i + 1)

  return (
    <div className="victory-screen">
      <div className="victory-title">DEBT ASSASSINATION COMPLETE</div>
      <div className="victory-sub">ALL 12 ENEMIES NEUTRALIZED · FINANCIAL LIBERATION ACHIEVED</div>
      <div className="victory-total">${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div className="victory-label">TOTAL DEBT ELIMINATED</div>

      <div className="victory-portraits">
        {skulls.map(i => (
          <div key={i} className="victory-portrait-mini">💀</div>
        ))}
      </div>

      <button className="btn-victory-close" onClick={onClose}>
        CONTINUE OPERATION
      </button>
    </div>
  )
}
