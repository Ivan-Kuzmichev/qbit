import { Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { t } from '../../i18n/ru'
import { formatBytes, plural } from '../../lib/format'
import { useTorrents } from '../../store/torrents'
import { runTorrentAction } from './actions'
import styles from './DeleteDialog.module.css'

export interface DeleteDialogProps {
  hashes: readonly string[]
  onClose(): void
}

export function DeleteDialog({ hashes, onClose }: DeleteDialogProps) {
  const torrents = useTorrents((s) => s.torrents)
  const [deleteFiles, setDeleteFiles] = useState(false)
  // Torrents can vanish while the dialog is open: always work with what still exists.
  const targets = useMemo(() => hashes.filter((h) => h in torrents).map((h) => torrents[h]), [hashes, torrents])
  const completed = targets.reduce((sum, x) => sum + (x.completed || 0), 0)
  const one = targets.length <= 1
  const title = one ? t.dialogs.deleteTitleOne : `${t.dialogs.deleteTitleMany} ${plural(targets.length, t.dialogs.torrentForms)}?`

  function confirm() {
    const ids = targets.map((x) => x.hash)
    onClose()
    void runTorrentAction('torrents/delete', ids, { deleteFiles })
  }

  return (
    <Dialog
      title={title}
      onClose={onClose}
      width={440}
      minHeight={260}
      icon={<Trash2 size={18} aria-hidden="true" />}
      description={one && targets[0] ? `«${targets[0].name}» ${t.dialogs.deleteBodyOne}` : t.dialogs.deleteBodyMany}
      hideClose
    >
      <label className={styles.option}>
        <input type="checkbox" className={styles.input} checked={deleteFiles} onChange={(e) => setDeleteFiles(e.target.checked)} />
        <span className={styles.box} aria-hidden="true" />
        <span className={styles.label}>{t.dialogs.deleteFiles}</span>
        <span className={styles.size}>{formatBytes(completed)}</span>
      </label>
      <div className={styles.actions}>
        <Button size="sm" onClick={onClose}>{t.dialogs.cancel}</Button>
        <Button size="sm" variant="danger" disabled={targets.length === 0} onClick={confirm}>
          {t.dialogs.deleteConfirm}
        </Button>
      </div>
    </Dialog>
  )
}
