import { Check } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import styles from './Checkbox.module.css'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  checked: boolean
  onChange(checked: boolean): void
  label: ReactNode
}

export function Checkbox({ checked, onChange, label, className, ...rest }: CheckboxProps) {
  return (
    <label className={[styles.root, className].filter(Boolean).join(' ')}>
      <input
        type="checkbox"
        className={styles.input}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        {...rest}
      />
      <span className={styles.box} aria-hidden="true">
        {checked && <Check size={12} strokeWidth={3} />}
      </span>
      <span>{label}</span>
    </label>
  )
}
