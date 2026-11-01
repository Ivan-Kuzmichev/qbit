import { nextIndex, focusSibling } from './useRovingKeys'
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
      {options.map((o, i) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          disabled={o.disabled}
          tabIndex={o.id === value ? 0 : -1}
          className={styles.item}
          onClick={() => onChange(o.id)}
          onKeyDown={(e) => {
            const to = nextIndex(e.key, i, options.map((x) => !x.disabled), true)
            if (to === null) return
            e.preventDefault()
            onChange(options[to].id)
            focusSibling(e, to)
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
