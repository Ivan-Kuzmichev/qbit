import styles from './Progress.module.css'

export interface ProgressProps {
  /** 0..1 */
  value: number
  tone: 'accent' | 'done' | 'dim'
  height: 10 | 12 | 14
  'aria-label'?: string
}

export function Progress({ value, tone, height, 'aria-label': label }: ProgressProps) {
  const pct = Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value * 100))) : 0
  return (
    <div
      className={styles.bar}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      data-tone={tone}
      style={{ height }}
    >
      <div className={styles.fill} style={{ width: `${pct}%` }} />
    </div>
  )
}
