const MESSAGES = {
  25:  { title: 'QUARTER DOWN',       copy: '25% eliminated. The assault has begun. Keep the pressure on.' },
  50:  { title: 'HALFWAY THROUGH',    copy: '50% neutralized. You are at the midpoint. The enemy is weakening.' },
  75:  { title: 'THREE-QUARTERS GONE', copy: '75% destroyed. Victory is within sight. Do not relent.' },
  100: { title: 'MISSION COMPLETE',   copy: 'ALL DEBTS NEUTRALIZED. You have achieved financial liberation.' },
}

export default function MilestoneOverlay({ milestone, onDismiss }) {
  const msg = MESSAGES[milestone] ?? MESSAGES[25]

  return (
    <div className="milestone-overlay" onClick={onDismiss}>
      <div className="milestone-pct">{milestone}%</div>
      <div className="milestone-title">{msg.title}</div>
      <div className="milestone-copy">{msg.copy}</div>
      <div className="milestone-dismiss">TAP TO CONTINUE</div>
    </div>
  )
}
