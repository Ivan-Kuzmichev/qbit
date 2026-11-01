import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TorrentFile } from '../../api/types'
import { Checkbox } from '../../components/ui/Checkbox'
import { Menu } from '../../components/ui/Menu'
import { toast } from '../../components/ui/Toast'
import { t } from '../../i18n/ru'
import { formatBytes } from '../../lib/format'
import { buildTree, flatten, type FlatRow, type TreeNode } from './fileTree'
import styles from './FilesTab.module.css'

export interface FilesTabProps {
  files: readonly TorrentFile[]
  /** Rejects when the request fails; the row is then reverted and a toast shown. */
  onSetPriority(ids: number[], priority: number): Promise<void>
  variant: 'desktop' | 'mobile'
  /** Mobile only: opens the priority action sheet (Task 18). */
  onPickPriority?(node: TreeNode): void
}

const PRIORITIES = [0, 1, 6, 7] as const
const VIRTUALIZE_ABOVE = 500
const ROW_HEIGHT = { desktop: 42, mobile: 76 }

const labelOf = (p: number | 'mixed', variant: 'desktop' | 'mobile') =>
  p === 'mixed' ? t.details.files.mixed : ((variant === 'mobile' ? t.details.files.prioritiesShort : t.details.files.priorities)[p] ?? String(p))

export function FilesTab({ files, onSetPriority, variant, onPickPriority }: FilesTabProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  // Optimistic priorities by file index, dropped once the poll confirms them or the request fails.
  const [pending, setPending] = useState<ReadonlyMap<number, number>>(new Map())

  useEffect(() => {
    setPending((prev) => {
      if (prev.size === 0) return prev
      const byIndex = new Map(files.map((f) => [f.index, f.priority]))
      const next = new Map([...prev].filter(([id, p]) => byIndex.has(id) && byIndex.get(id) !== p))
      return next.size === prev.size ? prev : next
    })
  }, [files])

  const effective = useMemo(
    () => (pending.size === 0 ? files : files.map((f) => (pending.has(f.index) ? { ...f, priority: pending.get(f.index) as number } : f))),
    [files, pending],
  )
  const tree = useMemo(() => buildTree(effective), [effective])
  const rows = useMemo(() => flatten(tree, collapsed), [tree, collapsed])

  const setPriority = useCallback(
    (ids: number[], priority: number) => {
      setPending((prev) => new Map([...prev, ...ids.map((id): [number, number] => [id, priority])]))
      onSetPriority(ids, priority).catch(() => {
        setPending((prev) => {
          const next = new Map(prev)
          ids.forEach((id) => next.delete(id))
          return next
        })
        toast(t.details.files.failed)
      })
    },
    [onSetPriority],
  )

  const toggle = useCallback(
    (path: string) =>
      setCollapsed((prev) => {
        const next = new Set(prev)
        if (!next.delete(path)) next.add(path)
        return next
      }),
    [],
  )

  const scroller = useRef<HTMLDivElement>(null)
  const virtual = rows.length > VIRTUALIZE_ABOVE
  // TanStack Virtual returns unmemoizable functions; nothing here is passed to memoized children
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: virtual ? rows.length : 0,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT[variant],
    overscan: 10,
  })

  if (files.length === 0) return <p className={styles.empty}>{t.details.files.empty}</p>

  const renderRow = ({ node, depth }: FlatRow, style?: React.CSSProperties) => (
    <Row
      key={node.path}
      node={node}
      depth={depth}
      variant={variant}
      open={!collapsed.has(node.path)}
      style={style}
      onToggle={toggle}
      onCheck={(on) => setPriority(node.ids, on ? 1 : 0)}
      onPriority={(p) => setPriority(node.ids, p)}
      onPick={onPickPriority}
    />
  )

  if (!virtual) return <div className={styles.list}>{rows.map((r) => renderRow(r))}</div>
  return (
    <div ref={scroller} className={styles.scroller}>
      <div className={styles.list} style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((v) =>
          renderRow(rows[v.index], {
            position: 'absolute', top: 0, left: 0, right: 0, height: v.size, transform: `translateY(${v.start}px)`,
          }),
        )}
      </div>
    </div>
  )
}

interface RowProps {
  node: TreeNode
  depth: number
  variant: 'desktop' | 'mobile'
  open: boolean
  style?: React.CSSProperties
  onToggle(path: string): void
  onCheck(on: boolean): void
  onPriority(p: number): void
  onPick?(node: TreeNode): void
}

function Row({ node, depth, variant, open, style, onToggle, onCheck, onPriority, onPick }: RowProps) {
  const folder = node.kind === 'folder'
  const off = node.checked === false
  const percent = `${Math.round(node.progress * 100)}%`
  const label = `${t.details.files.priority}: ${node.name}`
  const prio = (
    <>
      <span>{labelOf(node.priority, variant)}</span>
      <ChevronDown size={12} strokeWidth={2} aria-hidden="true" />
    </>
  )
  const items = PRIORITIES.map((p) => ({ id: String(p), label: t.details.files.priorities[p], onSelect: () => onPriority(p) }))
  const high = node.priority === 6 || node.priority === 7
  const prioClass = `${styles.prio} ${off ? styles.prioOff : ''} ${high ? styles.prioHigh : ''}`

  return (
    <div className={`${styles.row} ${styles[variant]}`} style={{ ...style, paddingLeft: depth * 16 }} data-kind={node.kind}>
      <span className={styles.twist}>
        {folder && (
          <button
            type="button"
            className={styles.twistBtn}
            aria-label={`${open ? t.details.files.collapse : t.details.files.expand} ${node.name}`}
            aria-expanded={open}
            onClick={() => onToggle(node.path)}
          >
            {open ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
          </button>
        )}
      </span>
      <Checkbox className={styles.check} checked={node.checked} onChange={onCheck} label={null} aria-label={node.name} />
      <div className={styles.cell}>
        <div className={styles.line}>
          <div className={styles.text}>
            <span className={`${styles.name} ${off ? styles.nameOff : ''}`} title={node.path}>
              {node.name}
            </span>
            {variant === 'mobile' && <span className={styles.size}>{formatBytes(node.size)}</span>}
          </div>
          {variant === 'desktop' && <span className={styles.size}>{formatBytes(node.size)}</span>}
          {variant === 'desktop' ? (
            <Menu items={items} label={label} triggerClassName={prioClass} portal>
              {prio}
            </Menu>
          ) : (
            <button type="button" className={prioClass} aria-label={label} onClick={() => onPick?.(node)}>
              {prio}
            </button>
          )}
        </div>
        <div className={styles.bar} role="progressbar" aria-label={node.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(node.progress * 100)}>
          <div className={styles.fill} style={{ width: percent }} />
        </div>
      </div>
    </div>
  )
}
