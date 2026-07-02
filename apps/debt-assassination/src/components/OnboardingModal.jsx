export default function OnboardingModal({ onDismiss }) {
  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div className="onboarding-corner tl" />
        <div className="onboarding-corner tr" />
        <div className="onboarding-corner bl" />
        <div className="onboarding-corner br" />

        <div className="onboarding-eyebrow">// SYSTEM INITIALIZED</div>

        <h1 className="onboarding-title">
          <span className="onboarding-glitch-r" aria-hidden="true">DEBT ASSASSINATION</span>
          <span className="onboarding-glitch-c" aria-hidden="true">DEBT ASSASSINATION</span>
          DEBT ASSASSINATION
        </h1>
        <div className="onboarding-subtitle">YOUR FINANCIAL HIT LIST</div>

        <div className="onboarding-steps">
          <div className="onboarding-step">
            <span className="step-num">01</span>
            <div className="step-body">
              <div className="step-title">YOUR TARGETS ARE LOADED</div>
              <div className="step-desc">12 creditors stand between you and financial freedom. Each one has a health bar. Drain them to zero.</div>
            </div>
          </div>
          <div className="onboarding-step">
            <span className="step-num">02</span>
            <div className="step-body">
              <div className="step-title">ATTACK IN ORDER</div>
              <div className="step-desc">Focus all extra cash on Target 01 — the lowest balance. Pay minimums everywhere else. When it drops to $0, that freed minimum becomes your new weapon.</div>
            </div>
          </div>
          <div className="onboarding-step">
            <span className="step-num">03</span>
            <div className="step-body">
              <div className="step-title">EVERY PAYMENT IS AN ATTACK</div>
              <div className="step-desc">Log payments, watch health bars drop, eliminate targets one by one. Each kill raises your Grid Integrity and unlocks a higher Clearance Tier.</div>
            </div>
          </div>
        </div>

        <div className="onboarding-tip">
          <div className="tip-label">// FIRST MISSION</div>
          <div className="tip-text">
            <strong>SET YOUR APRs</strong> — Tap <span className="tip-hl">+ APR</span> on each card to see exactly how much each creditor bleeds you per day. The BLEEDING/DAY number will make this feel real.
          </div>
        </div>

        <div className="onboarding-warning">
          <div className="warning-icon">⚠</div>
          <div className="warning-text">
            <strong>ENABLE AUTO-PAY MINIMUMS</strong> on every card immediately. One missed payment triggers counterattacks — late fees added directly to your balance.
          </div>
        </div>

        <button className="btn-enter-mission" onClick={onDismiss}>
          ENTER THE MISSION
        </button>
      </div>
    </div>
  )
}
