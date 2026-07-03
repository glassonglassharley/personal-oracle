import { PHASES } from '../constants'

export default function PhaseHeader({ phase, debts }) {
  const info = PHASES[phase]
  const complete = debts.every(d => d.balance <= 0)

  return (
    <div className={`phase-header ${complete ? 'complete' : ''}`}>
      <div className="phase-code">{info.label}</div>
      <div>
        <div className="phase-name">{info.name}</div>
        <div className="phase-desc">{info.desc}</div>
      </div>
    </div>
  )
}
