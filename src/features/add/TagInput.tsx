import { X } from 'lucide-react'
import { useId, useState } from 'react'
import { t } from '../../i18n'
import styles from './TagInput.module.css'

export interface TagInputProps {
  value: string[]
  onChange(tags: string[]): void
  suggestions: readonly string[]
}

export function TagInput({ value, onChange, suggestions }: TagInputProps) {
  const [draft, setDraft] = useState('')
  const listId = useId()
  const inputId = useId()

  function commit() {
    const tag = draft.trim().replace(/,/g, '')
    setDraft('')
    if (tag && !value.includes(tag)) onChange([...value, tag])
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {t.add.tags}
      </label>
      <div className={styles.frame}>
        {value.map((tag) => (
          <span key={tag} className={styles.chip}>
            {tag}
            <button
              type="button"
              className={styles.remove}
              aria-label={`${t.add.removeTag} ${tag}`}
              onClick={() => onChange(value.filter((x) => x !== tag))}
            >
              <X size={11} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          className={styles.input}
          list={listId}
          value={draft}
          placeholder={t.add.tagsPlaceholder}
          autoComplete="off"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              commit()
            } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
              onChange(value.slice(0, -1))
            }
          }}
        />
        <datalist id={listId}>
          {suggestions
            .filter((s) => !value.includes(s))
            .map((s) => (
              <option key={s} value={s} />
            ))}
        </datalist>
      </div>
    </div>
  )
}
