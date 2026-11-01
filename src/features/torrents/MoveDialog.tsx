import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Field } from '../../components/ui/Field'
import { t } from '../../i18n/ru'
import { useTorrents } from '../../store/torrents'
import { runTorrentAction } from './actions'
import styles from './MoveDialog.module.css'

export interface MoveDialogProps {
  hashes: readonly string[]
  onClose(): void
}

export function MoveDialog({ hashes, onClose }: MoveDialogProps) {
  // Prefilled only for a single torrent; with several there is no one current path.
  const [path, setPath] = useState(() => {
    const { torrents } = useTorrents.getState()
    return hashes.length === 1 ? (torrents[hashes[0]]?.save_path ?? '') : ''
  })
  const location = path.trim()

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!location) return
    const { torrents } = useTorrents.getState()
    const ids = hashes.filter((h) => h in torrents)
    onClose()
    void runTorrentAction('torrents/setLocation', ids, { location })
  }

  return (
    <Dialog title={t.dialogs.moveTitle} onClose={onClose}>
      <form onSubmit={submit} className={styles.form}>
        {hashes.length > 1 && <p className={styles.text}>{t.dialogs.moveBodyMany}</p>}
        <Field label={t.dialogs.movePath} value={path} onChange={(e) => setPath(e.target.value)} autoComplete="off" spellCheck={false} />
        <div className={styles.actions}>
          <Button size="sm" onClick={onClose}>
            {t.dialogs.cancel}
          </Button>
          <Button size="sm" variant="primary" type="submit" disabled={!location}>
            {t.dialogs.moveConfirm}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
