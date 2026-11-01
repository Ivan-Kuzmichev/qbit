import { ArrowDown, ArrowUp, Check, Columns3 } from 'lucide-react'
import { Menu, type MenuItem } from '../../components/ui/Menu'
import { t } from '../../i18n'
import { useUi, type OptionalColumn, type SortDir } from '../../store/ui'
import { OPTIONAL_COLUMNS, type Column } from './columns'
import styles from './TableHeader.module.css'

export interface TableHeaderProps {
  columns: Column[]
  template: string
}

export function TableHeader({ columns, template }: TableHeaderProps) {
  const sort = useUi((s) => s.sort)
  const setSort = useUi((s) => s.setSort)
  const visible = useUi((s) => s.columns)
  const setColumn = useUi((s) => s.setColumn)

  const items: MenuItem[] = OPTIONAL_COLUMNS.map((c) => ({
    id: c.id,
    label: c.label,
    icon: visible[c.id as OptionalColumn] ? <Check size={14} aria-hidden="true" /> : <span className={styles.noCheck} />,
    onSelect: () => setColumn(c.id as OptionalColumn, !visible[c.id as OptionalColumn]),
  }))

  function click(c: Column) {
    const dir: SortDir = sort.key === c.sortKey ? (sort.dir === 'asc' ? 'desc' : 'asc') : c.firstDir
    setSort({ key: c.sortKey, dir })
  }

  return (
    <div role="row" aria-rowindex={1} className={styles.header} style={{ gridTemplateColumns: template }}>
      <span role="columnheader" className={styles.menuCell} aria-label={t.table.columns}>
        <span className={styles.menu}>
          <Menu items={items} label={t.table.columns}>
            <Columns3 size={15} aria-hidden="true" />
          </Menu>
        </span>
      </span>
      {columns.map((c) => {
        const active = sort.key === c.sortKey
        return (
          <span
            key={c.id}
            role="columnheader"
            aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
            className={c.align === 'right' ? styles.right : undefined}
          >
            <button type="button" className={styles.sort} onClick={() => click(c)}>
              {c.label}
              {active && (sort.dir === 'asc' ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
            </button>
          </span>
        )
      })}
    </div>
  )
}
