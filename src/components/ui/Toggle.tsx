import styles from './Toggle.module.css'

export interface ToggleProps {
  checked: boolean
  onChange(checked: boolean): void
  'aria-label': string
  disabled?: boolean
}

export function Toggle({ checked, onChange, disabled, 'aria-label': label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={styles.toggle}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} />
    </button>
  )
}
