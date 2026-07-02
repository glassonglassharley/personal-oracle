export function computeChartHeader({ sliced = [], hovered = null, range = '1W' }) {
  const tip = hovered != null ? sliced[hovered] : sliced[sliced.length - 1]
  const tipVal = tip?.value ?? 0
  const tipDate = tip?.date ?? ''
  const startVal = sliced[0]?.value ?? 0
  const delta = tipVal - startVal

  const oneDayDisplay = range === '1D' && typeof tip?.day === 'number'
    ? tip.day
    : tipVal

  return {
    tip,
    tipVal,
    tipDate,
    startVal,
    delta,
    displayVal: oneDayDisplay,
    pctBase: range === '1D' ? null : startVal,
  }
}
