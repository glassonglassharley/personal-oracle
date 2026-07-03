import { useState, useEffect, useRef, useCallback } from 'react'
import GridBg from './components/GridBg'
import './styles.css'
import './battle.css'
import StatsRow from './components/StatsRow'
import ProgressBar from './components/ProgressBar'
import PhaseHeader from './components/PhaseHeader'
import DebtRow from './components/DebtRow'
import PaymentModal from './components/PaymentModal'
import EditBalanceModal from './components/EditBalanceModal'
import AddDebtModal from './components/AddDebtModal'
import AprModal from './components/AprModal'
import HamburgerMenu from './components/HamburgerMenu'
import OnboardingModal from './components/OnboardingModal'
import PaymentHistory from './components/PaymentHistory'
import MilestoneOverlay from './components/MilestoneOverlay'
import Confetti from './components/Confetti'
import BattleMode from './components/BattleMode'
import ClearanceLevelPanel from './components/ClearanceLevelPanel'
import SyncScoreModal from './components/SyncScoreModal'
import { useDebtStore } from './hooks/useDebtStore'
import { usePlaidSync } from './hooks/usePlaidSync'
import PlaidMappingModal from './components/PlaidMappingModal'
import RobinhoodPortfolioModal from './components/RobinhoodPortfolioModal'
import RobinhoodHarvestModal from './components/RobinhoodHarvestModal'
import AutopayCalendarModal from './components/AutopayCalendarModal'
import CreditDirectorChatbot from './components/CreditDirectorChatbot'
import { PHASES } from './constants'

const MILESTONES = [25, 50, 75, 100]
const THEME_STORAGE_KEY = 'debt-assassination-theme'

export default function App() {
  const store = useDebtStore()
  const [themeMode, setThemeMode] = useState(() => {
    try { return localStorage.getItem(THEME_STORAGE_KEY) || 'dark' } catch { return 'dark' }
  })
  const [payingDebt, setPayingDebt] = useState(null)
  const [editingDebt, setEditingDebt] = useState(null)
  const [toasts, setToasts] = useState([])
  const [showConfetti, setShowConfetti] = useState(false)
  const [pendingMilestone, setPendingMilestone] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [syncScoreOpen, setSyncScoreOpen] = useState(false)
  const [addDebtOpen, setAddDebtOpen] = useState(false)
  const [aprDebt, setAprDebt] = useState(null)
  const [showPortfolioModal, setShowPortfolioModal] = useState(false)
  const [showHarvestModal, setShowHarvestModal] = useState(false)
  const [showAutopayCalendar, setShowAutopayCalendar] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem('hasSeenOnboarding') } catch { return false }
  })

  const sectionRef = useRef(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const safeTheme = themeMode === 'light' ? 'light' : 'dark'
    el.classList.toggle('theme-light', safeTheme === 'light')
    el.classList.toggle('theme-dark', safeTheme === 'dark')
    el.style.colorScheme = safeTheme
    try { localStorage.setItem(THEME_STORAGE_KEY, safeTheme) } catch {}
    return () => {
      el.classList.remove('theme-light', 'theme-dark')
      el.style.colorScheme = ''
    }
  }, [themeMode])

  // Milestone trigger
  useEffect(() => {
    const next = MILESTONES.find(
      m => store.percentComplete >= m && !store.milestonesShown.includes(m)
    )
    if (next && next !== pendingMilestone) setPendingMilestone(next)
  }, [store.percentComplete, store.milestonesShown])

  const addToast = useCallback((msg, type = 'red') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const plaid = usePlaidSync({ store, addToast })

  const didAutoSync = useRef(false)
  useEffect(() => {
    if (!didAutoSync.current && plaid.isConnected) {
      didAutoSync.current = true
      plaid.syncBalances({ silent: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePayment = useCallback((debtId, amount) => {
    const result = store.makePayment(debtId, amount)
    setPayingDebt(null)
    addToast(`PAYMENT LOGGED: $${amount.toFixed(2)}`, 'red')
    if (result?.cardKilled) {
      setShowConfetti(true)
      addToast('CARD NEUTRALIZED', 'gold')
      setTimeout(() => setShowConfetti(false), 3500)
    }
  }, [store, addToast])

  const handleReset = useCallback(() => {
    if (resetConfirm) {
      store.reset()
      setResetConfirm(false)
      addToast('SYSTEM RESET', 'red')
    } else {
      setResetConfirm(true)
      setTimeout(() => setResetConfirm(false), 5000)
    }
  }, [resetConfirm, store, addToast])

  const phaseGroups = [1, 2, 3].map(phase => ({
    phase,
    debts: store.debts.filter(d => d.phase === phase),
  }))

  const isDashboard = store.viewMode !== 'battle'

  return (
    <div className="debt-app" ref={sectionRef}>
      <GridBg />
      <div className="crt-overlay" />
      <HamburgerMenu
        addToast={addToast}
        onImport={store.importState}
        onShowIntro={() => setShowOnboarding(true)}
        plaid={plaid}
        robinhoodStatus={store.robinhoodStatus}
        totalAutopayCommitted={store.totalAutopayCommitted}
        onReadPortfolio={() => setShowPortfolioModal(true)}
        onHarvestOpportunities={() => setShowHarvestModal(true)}
        onShowAutopayCalendar={() => setShowAutopayCalendar(true)}
      />
      {plaid.showMappingModal && (
        <PlaidMappingModal
          accounts={plaid.unmatchedAccounts}
          debts={store.debts}
          onSave={plaid.saveMappings}
          onClose={() => plaid.setShowMappingModal(false)}
        />
      )}
      {showOnboarding && (
        <OnboardingModal onDismiss={() => {
          try { localStorage.setItem('hasSeenOnboarding', '1') } catch {}
          setShowOnboarding(false)
        }} />
      )}

      {showConfetti && <Confetti />}

      {pendingMilestone && (
        <MilestoneOverlay
          milestone={pendingMilestone}
          onDismiss={() => {
            store.markMilestoneShown(pendingMilestone)
            setPendingMilestone(null)
          }}
        />
      )}

      {payingDebt && (
        <PaymentModal
          debt={payingDebt}
          onPay={handlePayment}
          onClose={() => setPayingDebt(null)}
        />
      )}
      {editingDebt && (
        <EditBalanceModal
          debt={editingDebt}
          onSave={(id, bal) => {
            const result = store.editBalance(id, bal)
            setEditingDebt(null)
            addToast(result?.delta > 0 ? 'BALANCE INCREASED' : 'BALANCE UPDATED', result?.delta > 0 ? 'red' : 'gold')
          }}
          onClose={() => setEditingDebt(null)}
        />
      )}
      {addDebtOpen && (
        <AddDebtModal
          onAdd={(payload) => {
            const added = store.addDebt(payload)
            setAddDebtOpen(false)
            addToast(added ? `TARGET ADDED: ${added.enemyName}` : 'TARGET ADD FAILED', added ? 'gold' : 'red')
          }}
          onClose={() => setAddDebtOpen(false)}
        />
      )}
      {aprDebt && (
        <AprModal
          debt={aprDebt}
          onSave={(id, apr) => {
            store.updateAPR(id, apr)
            addToast(apr ? `APR SET: ${apr}%` : 'APR CLEARED', 'gold')
          }}
          onClose={() => setAprDebt(null)}
        />
      )}
      {syncScoreOpen && (
        <SyncScoreModal
          currentScore={store.creditScore}
          onSync={score => {
            store.syncCreditScore(score)
            setSyncScoreOpen(false)
            addToast('GRID BASELINE SYNCED', 'gold')
          }}
          onClose={() => setSyncScoreOpen(false)}
        />
      )}
      {showPortfolioModal && (
        <RobinhoodPortfolioModal
          status={store.robinhoodStatus}
          onClose={() => setShowPortfolioModal(false)}
        />
      )}
      {showHarvestModal && (
        <RobinhoodHarvestModal
          status={store.robinhoodStatus}
          activeTarget={store.activeTarget}
          splitPref={store.harleyDefiSplit}
          onSaveSplit={split => { store.setHarleyDefiSplit(split); addToast('SPLIT PREFERENCE SAVED', 'gold') }}
          onLogHarvest={(ticker, amount, targetDebt) => {
            store.logHarvestPlan(ticker, amount, targetDebt)
            addToast(`HARVEST PLANNED: $${amount.toFixed(2)} from ${ticker}`, 'gold')
          }}
          onClose={() => setShowHarvestModal(false)}
        />
      )}
      {showAutopayCalendar && (
        <AutopayCalendarModal
          debts={store.debts}
          onUpdateDueDay={(debtId, dueDay) => store.setAutopayDueDay(debtId, dueDay)}
          autopayThreshold={store.autopayThreshold}
          onSetThreshold={store.setAutopayThreshold}
          onClose={() => setShowAutopayCalendar(false)}
        />
      )}

      {isDashboard ? (
        <main className="app-main">
          {/* View toggle */}
          <div className="view-toggle">
            <button
              className="view-toggle-btn theme-mode-toggle"
              onClick={() => setThemeMode(mode => mode === 'dark' ? 'light' : 'dark')}
              aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
            >
              {themeMode === 'dark' ? '☀ LIGHT MODE' : '☾ DARK MODE'}
            </button>
            <button className="view-toggle-btn active">DASHBOARD</button>
            <button className="view-toggle-btn" onClick={() => store.setViewMode('battle')}>BATTLE MODE</button>
          </div>

          {/* Title */}
          <header className="app-header">
            <h1 className="app-title">
              <span className="glitch-layer glitch-red" aria-hidden="true">DEBT ASSASSINATION</span>
              <span className="glitch-layer glitch-cyan" aria-hidden="true">DEBT ASSASSINATION</span>
              DEBT <span className="title-accent">ASSASSINATION</span>
            </h1>
            <p className="app-subtitle">{store.cardsKilled}/{store.debts.length} NEUTRALIZED{store.freedUpMinimums > 0 ? ` · $${store.freedUpMinimums.toFixed(2)}/mo freed` : ''}</p>
          </header>

          <StatsRow
            totalRemaining={store.totalRemaining}
            totalPaid={store.totalPaid}
            cardsKilled={store.cardsKilled}
            totalCards={store.debts.length}
            freedUp={store.freedUpMinimums}
            totalDailyInterest={store.totalDailyInterest}
          />

          <ClearanceLevelPanel
            gridIntegrity={store.gridIntegrity}
            projectedScore={store.projectedScore}
            clearanceTier={store.clearanceTier}
            nextClearanceTier={store.nextClearanceTier}
            progressToNext={store.progressToNext}
            lastSynced={store.lastSynced}
            highUtilizationCount={store.highUtilizationCount}
            onSync={() => setSyncScoreOpen(true)}
          />

          <ProgressBar percent={store.percentComplete} totalPaid={store.totalPaid} totalOriginalDebt={store.totalOriginalDebt} />

          <CreditDirectorChatbot store={store} />

          <section className="add-target-panel">
            <div>
              <div className="add-target-label">// TARGET REGISTRY</div>
              <p className="add-target-copy">Add new debts as villains. The hit list re-ranks automatically by total amount owed.</p>
            </div>
            <button className="btn-add-target" onClick={() => setAddDebtOpen(true)}>+ ADD DEBT / VILLAIN</button>
          </section>

          {/* Active target */}
          {store.activeTarget && (
            <section className="active-target">
              <div className="active-target-label">// ACTIVE TARGET</div>
              <div className="active-target-lender">{store.activeTarget.lender}</div>
              <div className="active-target-balance">${store.activeTarget.balance.toFixed(2)}</div>
              <div className="active-target-instruction">
                TARGET LOWEST BALANCE · EXECUTE PAYMENT NOW
              </div>
              <button className="btn-execute" onClick={() => setPayingDebt(store.activeTarget)}>
                EXECUTE PAYMENT
              </button>
            </section>
          )}

          {/* Phase sections */}
          {phaseGroups.map(({ phase, debts }) => (
            <section key={phase} className="phase-section">
              <PhaseHeader phase={phase} debts={debts} />
              <div className="debt-list">
                {debts.map(debt => (
                  <DebtRow
                    key={debt.id}
                    debt={debt}
                    rank={store.debts.findIndex(d => d.id === debt.id) + 1}
                    isActive={debt.id === store.activeTarget?.id}
                    onPay={() => setPayingDebt(debt)}
                    onEdit={() => setEditingDebt(debt)}
                    onUpdateMinPayment={amt => store.updateMinPayment(debt.id, amt)}
                    onSetApr={setAprDebt}
                    onSetAutopay={(enabled, amount) => store.setAutopay(debt.id, enabled, amount)}
                  />
                ))}
              </div>
            </section>
          ))}

          <PaymentHistory
            history={store.paymentHistory}
            open={historyOpen}
            onToggle={() => setHistoryOpen(o => !o)}
          />

          <footer className="protection-footer">
            <div className="protection-bar" />
            <div>
              <div className="protection-label">PROTECTION PROTOCOL</div>
              <p className="protection-text">
                Always maintain minimum payments on all accounts. Never miss a due date.
                Target lowest balance first. Redirect freed minimums to next target.
                Every dollar paid is a permanent victory. Keep attacking.
              </p>
            </div>
          </footer>

          <div className="reset-section">
            <button
              className={`btn-reset ${resetConfirm ? 'confirm' : ''}`}
              onClick={handleReset}
            >
              {resetConfirm ? '⚠ CONFIRM — CLICK AGAIN TO WIPE ALL DATA' : 'SYS::RESET'}
            </button>
          </div>
        </main>
      ) : (
        <>
          <div className="battle-shell-header">
            <div className="view-toggle">
              <button
                className="view-toggle-btn theme-mode-toggle"
                onClick={() => setThemeMode(mode => mode === 'dark' ? 'light' : 'dark')}
                aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
              >
                {themeMode === 'dark' ? '☀ LIGHT MODE' : '☾ DARK MODE'}
              </button>
              <button className="view-toggle-btn" onClick={() => store.setViewMode('dashboard')}>DASHBOARD</button>
              <button className="view-toggle-btn active">BATTLE MODE</button>
            </div>
            <header className="app-header">
              <h1 className="app-title">
                <span className="glitch-layer glitch-red" aria-hidden="true">DEBT ASSASSINATION</span>
                <span className="glitch-layer glitch-cyan" aria-hidden="true">DEBT ASSASSINATION</span>
                DEBT ASSASSINATION
              </h1>
            </header>
          </div>
          <BattleMode
            store={store}
            addToast={addToast}
            lastSyncLabel={plaid.lastSyncLabel}
            syncOverdue={plaid.syncOverdue}
            syncFlash={plaid.syncFlash}
          />
        </>
      )}

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  )
}
