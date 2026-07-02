import { useMemo } from 'react'
import RobinhoodChart from './RobinhoodChart.jsx'
import { buildCumulativeRepSeries } from './progressSeries.js'

export default function ProgressChart({ history, dayData, customExercises = [], theme }) {
  const points = useMemo(() => buildCumulativeRepSeries(history, dayData, customExercises), [history, dayData, customExercises])

  return (
    <RobinhoodChart
      points={points}
      color="#22c55e"
      defaultRange="1W"
      isDark={theme === 'dark'}
      unit="reps"
      title="Growth"
      subtitle="total accumulated reps"
      emptyLabel="Log workouts to grow your chart"
      showSun
    />
  )
}
