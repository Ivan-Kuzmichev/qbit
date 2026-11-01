import { nextIndex, focusSibling } from './useRovingKeys'
import styles from './Tabs.module.css'

export interface TabsProps<T extends string> {
  tabs: readonly { id: T; label: string }[]
  value: T
  onChange(id: T): void
  'aria-label'?: string
  /** When set, tabs get ids `${idPrefix}-tab-${id}` and point at the panel `${idPrefix}-panel`. */
  idPrefix?: string
}

export function Tabs<T extends string>({ tabs, value, onChange, 'aria-label': label, idPrefix }: TabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className={styles.list}>
      {tabs.map((tab, i) => (
        <button
          key={tab.id}
          id={idPrefix ? `${idPrefix}-tab-${tab.id}` : undefined}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          aria-controls={idPrefix ? `${idPrefix}-panel` : undefined}
          tabIndex={tab.id === value ? 0 : -1}
          className={styles.tab}
          onClick={() => onChange(tab.id)}
          onKeyDown={(e) => {
            const to = nextIndex(e.key, i, tabs.map(() => true))
            if (to === null) return
            e.preventDefault()
            onChange(tabs[to].id)
            focusSibling(e, to)
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
