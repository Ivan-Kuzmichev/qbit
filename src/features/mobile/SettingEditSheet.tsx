import { useCallback, useState } from 'react'
import type { Preferences } from '../../api/types'
import { Dialog } from '../../components/ui/Dialog'
import { t } from '../../i18n/ru'
import { diffPrefs } from '../settings/diffPrefs'
import type { Row } from '../settings/schema'
import { SettingRow } from '../settings/SettingRow'
import styles from './SettingEditSheet.module.css'

export interface SettingEditSheetProps {
  title: string
  rows: Row[]
  draft: Preferences
  set<K extends keyof Preferences>(key: K, value: Preferences[K]): void
  setInvalid(key: string, bad: boolean): void
  onClose(): void
}

/**
 * Edits one or two settings in a bottom sheet. Edits go straight into the draft so the rows
 * (and their dependants) behave as on the page; "Отмена" puts back what the sheet opened with.
 */
export function SettingEditSheet({ title, rows, draft, set, setInvalid, onClose }: SettingEditSheetProps) {
  const [opened] = useState(draft)
  const [bad, setBad] = useState<ReadonlySet<string>>(new Set())

  const track = useCallback(
    (key: string, isBad: boolean) => {
      setBad((prev) => {
        if (prev.has(key) === isBad) return prev
        const next = new Set(prev)
        if (isBad) next.add(key)
        else next.delete(key)
        return next
      })
      setInvalid(key, isBad)
    },
    [setInvalid],
  )

  function cancel() {
    for (const key of Object.keys(diffPrefs(opened, draft)) as (keyof Preferences)[]) set(key, opened[key])
    onClose()
  }

  return (
    <Dialog title={title} onClose={cancel}>
      <div className={styles.rows}>
        {rows.map((row) => (
          <SettingRow key={row.key} row={row} draft={draft} set={set} setInvalid={track} />
        ))}
      </div>
      <div className={styles.footer}>
        <button type="button" className={styles.cancel} onClick={cancel}>
          {t.dialogs.cancel}
        </button>
        <button type="button" className={styles.done} disabled={bad.size > 0} onClick={onClose}>
          {t.mobile.done}
        </button>
      </div>
    </Dialog>
  )
}
