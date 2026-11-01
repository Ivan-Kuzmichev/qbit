const W = 180
const H = 28
const PAD = 2

/** Line chart of any number of points; fewer than two draw nothing. */
export function Sparkline({ values }: { values: number[] }) {
  let points = ''
  if (values.length >= 2) {
    const max = Math.max(...values, 1)
    const step = W / (values.length - 1)
    points = values
      .map((v, i) => {
        const y = H - PAD - (Math.max(v, 0) / max) * (H - PAD * 2)
        return `${+(i * step).toFixed(1)},${+y.toFixed(1)}`
      })
      .join(' ')
  }
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" fill="none" aria-hidden="true">
      {points && (
        <polyline points={points} stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  )
}
