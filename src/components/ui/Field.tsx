import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import styles from './Field.module.css'

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string
  /** Control inside the field frame, e.g. a show-password button. */
  trailing?: ReactNode
  /** Decoration before the input, e.g. a folder icon. */
  leading?: ReactNode
  /** Field height in px on desktop; mobile is never below 44px. */
  height?: 36 | 38 | 40
  /** Monospace value, for paths. */
  mono?: boolean
}

export function Field({ label, trailing, leading, height = 38, mono, className, id, ...rest }: FieldProps) {
  const auto = useId()
  const inputId = id ?? auto
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <div className={styles.frame} data-height={height} style={{ '--field-h': `${height}px` } as React.CSSProperties}>
        {leading && <span className={styles.leading}>{leading}</span>}
        <input id={inputId} className={`${styles.input} ${mono ? styles.mono : ''}`} {...rest} />
        {trailing}
      </div>
    </div>
  )
}
