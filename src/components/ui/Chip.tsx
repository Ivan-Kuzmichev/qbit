import type { ReactNode } from 'react'
import styles from './Chip.module.css'

export interface ChipProps {
  /** `solid` is the accent status chip in the details card. */
  tone?: 'neutral' | 'solid'
  children: ReactNode
}

export function Chip({ tone = 'neutral', children }: ChipProps) {
  return (
    <span className={styles.chip} data-tone={tone}>
      {children}
    </span>
  )
}
