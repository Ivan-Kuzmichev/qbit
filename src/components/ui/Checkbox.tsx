import { Check, Minus } from 'lucide-react'
import { useEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react'
import styles from './Checkbox.module.css'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'checked'> {
  /** `'mixed'` shows the indeterminate state; a click then reports `true`. */
  checked: boolean | 'mixed'
  onChange(checked: boolean): void
  label: ReactNode
}

export function Checkbox({ checked, onChange, label, className, ...rest }: CheckboxProps) {
  const input = useRef<HTMLInputElement>(null)
  const mixed = checked === 'mixed'
  useEffect(() => {
    if (input.current) input.current.indeterminate = mixed
  }, [mixed])
  return (
    <label className={[styles.root, className].filter(Boolean).join(' ')}>
      <input
        ref={input}
        type="checkbox"
        className={styles.input}
        checked={checked === true}
        aria-checked={mixed ? 'mixed' : undefined}
        onChange={(e) => onChange(e.target.checked)}
        {...rest}
      />
      <span className={styles.box} aria-hidden="true">
        {mixed ? <Minus size={12} strokeWidth={3} /> : checked && <Check size={12} strokeWidth={3} />}
      </span>
      {label !== null && label !== undefined && <span>{label}</span>}
    </label>
  )
}
