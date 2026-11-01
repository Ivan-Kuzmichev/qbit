import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { t } from '../../i18n/ru'
import { categoryColor } from '../../lib/categoryColor'
import styles from './CategorySelect.module.css'

export interface CategorySelectProps {
  value: string
  categories: readonly string[]
  onChange(name: string): void
  /** Creates the category on the server; resolves false if that failed. */
  onCreate(name: string): Promise<boolean>
}

export function CategorySelect({ value, categories, onChange, onCreate }: CategorySelectProps) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const labelId = useId()
  const valueId = useId()

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function pick(next: string) {
    onChange(next)
    setOpen(false)
    setCreating(false)
  }

  async function create() {
    const n = name.trim()
    if (!n) return
    if (await onCreate(n)) {
      setName('')
      pick(n)
    }
  }

  const all = value && !categories.includes(value) ? [value, ...categories] : categories

  return (
    <div className={styles.root} ref={root}>
      <span id={labelId} className={styles.label}>
        {t.add.category}
      </span>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${labelId} ${valueId}`}
        onClick={() => setOpen((o) => !o)}
      >
        {value && <span className={styles.dot} style={{ background: categoryColor(value) }} aria-hidden="true" />}
        <span id={valueId} className={styles.value}>
          {value || t.add.noCategory}
        </span>
        <ChevronDown size={14} strokeWidth={2} aria-hidden="true" color="var(--muted)" />
      </button>
      {open && (
        <div className={styles.popover}>
          <ul role="listbox" aria-labelledby={labelId} className={styles.list}>
            <li role="option" aria-selected={value === ''} tabIndex={0} className={styles.option} onClick={() => pick('')} onKeyDown={(e) => e.key === 'Enter' && pick('')}>
              {t.add.noCategory}
            </li>
            {all.map((c) => (
              <li key={c} role="option" aria-selected={c === value} tabIndex={0} className={styles.option} onClick={() => pick(c)} onKeyDown={(e) => e.key === 'Enter' && pick(c)}>
                <span className={styles.dot} style={{ background: categoryColor(c) }} aria-hidden="true" />
                {c}
              </li>
            ))}
            <li role="option" aria-selected={false} tabIndex={0} className={styles.option} onClick={() => setCreating(true)} onKeyDown={(e) => e.key === 'Enter' && setCreating(true)}>
              {t.add.newCategory}
            </li>
          </ul>
          {creating && (
            <div className={styles.create}>
              <input
                className={styles.input}
                aria-label={t.add.newCategoryName}
                value={name}
                autoFocus
                autoComplete="off"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void create()
                  }
                }}
              />
              <button type="button" className={styles.createBtn} disabled={!name.trim()} onClick={() => void create()}>
                {t.add.createCategory}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
