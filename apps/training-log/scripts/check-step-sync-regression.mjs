import assert from 'node:assert/strict'
import {
  displayStepsForStatus,
  reconcileGoogleFitStepData,
  reconcileStepData,
} from '../src/stepSync.js'

const todayDate = '2026-07-02'
const googleWeek = [
  { date: '2026-06-30', steps: 920 },
  { date: '2026-07-01', steps: 1044 },
  { date: todayDate, steps: 214 },
]

const freshGoogle = reconcileGoogleFitStepData(214, googleWeek, { todayDate })
assert.equal(
  freshGoogle.today,
  214,
  'fresh Google Fit total must be allowed to drop below stale saved local steps'
)
assert.equal(
  freshGoogle.week.find(day => day.date === todayDate)?.steps,
  214,
  'today week bucket must use the fresh Google Fit total, not stale local cache'
)
assert.equal(
  displayStepsForStatus({ status: 'ready', todaySteps: freshGoogle.today, localSteps: 1044 }),
  214,
  'ready Google Fit display must show synced provider total, not Math.max(provider, stale local)'
)

const savedFallback = reconcileStepData(214, googleWeek, 1044, { todayDate })
assert.equal(
  savedFallback.today,
  1044,
  'non-provider fallback reconciliation should still preserve the highest saved local value'
)
assert.equal(
  displayStepsForStatus({ status: 'loading', todaySteps: 214, localSteps: 1044 }),
  1044,
  'loading/disconnected display should keep showing saved local steps until provider sync succeeds'
)

console.log('Step sync regression guard passed: fresh Google Fit 214 can replace stale local 1,044, while saved fallback still preserves local steps before provider sync.')
