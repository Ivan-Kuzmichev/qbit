import styles from './Segmented.module.css'

export interface SegmentedProps<T extends string> {
  options: readonly { id: T; label: string; disabled?: boolean }[]
  value: T
  onChange(id: T): void
  'aria-label'?: string
}

export function Segmented<T extends string>({ options, value, onChange, 'aria-label': label }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={styles.root}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          disabled={o.disabled}
          className={styles.item}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
