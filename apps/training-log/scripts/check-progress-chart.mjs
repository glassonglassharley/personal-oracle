import assert from 'node:assert/strict'
import { dayReps, buildCumulativeRepSeries } from '../src/progressSeries.js'
import { computeChartHeader } from '../src/robinhoodChartMath.js'

const today = '2026-06-21'
const yesterday = '2026-06-20'
const customExercises = [{ id: 'dips', name: 'Dips', type: 'reps' }]

const visibleTileTotal = 50 + 25 + 10 + 5
const day = {
  date: today,
  pushups: 50,
  squats: 25,
  situps: 0,
  pullups: 0,
  curls: 10,
  curlsWeight: 25,
  dips: 5,
  bench: { weight: 135, reps: 0 },

  // These are intentionally present to guard against the old bug.
  // Growth must not count non-visible stale/deleted exercises or telemetry.
  deleted_dips: 40,
  old_custom_rows: { reps: 15 },
  dead_hang: 45,
  steps: 6834,
  sleepHours: 7.5,
  water: 8,
  meals: [{ name: 'breakfast' }],
  rest: true,
}

assert.equal(
  dayReps(day, customExercises),
  visibleTileTotal,
  'Growth daily reps must match visible workout tiles and ignore stale/non-tile fields',
)

const points = buildCumulativeRepSeries([
  { date: yesterday, pushups: 100, deleted_dips: 40, old_custom_rows: { reps: 15 }, water: 6, steps: 5000 },
  { date: today, pushups: 145, deleted_dips: 55 }, // live dayData below must replace stale same-day history
], day, customExercises, today)

assert.deepEqual(points.map(p => ({ date: p.date, day: p.day })), [
  { date: yesterday, day: 100 },
  { date: today, day: visibleTileTotal },
])
assert.equal(points.at(-1).value, 190, 'Growth total should use reconciled daily totals only')
assert.equal(points.at(-1).day, visibleTileTotal, 'Growth 1D/day value should match visible tiles')

const oneDayHeader = computeChartHeader({ sliced: points.slice(-2), range: '1D' })
assert.equal(oneDayHeader.displayVal, visibleTileTotal, '1D chart headline value should match today visible tile reps')
assert.equal(oneDayHeader.tipVal, 190, 'tooltip total should remain cumulative after daily reconciliation')
assert.equal(oneDayHeader.pctBase, null, '1D chart should not show a cumulative all-time percentage')

console.log('progress chart visible-tile regression passed')
