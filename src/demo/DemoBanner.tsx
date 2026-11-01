import { X } from 'lucide-react'
import { useState } from 'react'
import { t } from '../i18n'
import styles from './DemoBanner.module.css'

export function DemoBanner() {
  const [open, setOpen] = useState(true)
  if (!open) return null
  return (
    <aside className={styles.banner} aria-label={t.demo.label}>
      <span>{t.demo.text}</span>
      <a href="https://github.com/Ivan-Kuzmichev/qbit#install" target="_blank" rel="noreferrer" className={styles.link}>
        {t.demo.install}
      </a>
      <button type="button" className={styles.close} aria-label={t.app.close} onClick={() => setOpen(false)}>
        <X size={14} aria-hidden="true" />
      </button>
    </aside>
  )
}
