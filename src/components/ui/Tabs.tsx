import styles from './Tabs.module.css'

export interface TabsProps<T extends string> {
  tabs: readonly { id: T; label: string }[]
  value: T
  onChange(id: T): void
  'aria-label'?: string
}

export function Tabs<T extends string>({ tabs, value, onChange, 'aria-label': label }: TabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className={styles.list}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          className={styles.tab}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
