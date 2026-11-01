import type { ButtonHTMLAttributes } from 'react'
import styles from './IconButton.module.css'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string
}

export function IconButton({ className, type = 'button', ...rest }: IconButtonProps) {
  return <button type={type} className={[styles.button, className].filter(Boolean).join(' ')} {...rest} />
}
