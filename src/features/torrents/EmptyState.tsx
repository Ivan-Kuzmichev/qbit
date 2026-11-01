import { Inbox, SearchX } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { t } from '../../i18n/ru'
import { useDialogs } from '../../store/dialogs'
import { useUi } from '../../store/ui'
import { ALL_FILTER } from './filters'
import styles from './EmptyState.module.css'

/** `none`: qBittorrent has no torrents. `noMatch`: there are some, but the search or filter hides them all. */
export function EmptyState({ kind }: { kind: 'none' | 'noMatch' }) {
  const none = kind === 'none'
  const Icon = none ? Inbox : SearchX
  return (
    <div className={styles.root}>
      <Icon size={28} strokeWidth={1.6} aria-hidden="true" className={styles.icon} />
      <p className={styles.title}>{none ? t.empty.noneTitle : t.empty.noMatchTitle}</p>
      <p className={styles.hint}>{none ? t.empty.noneHint : t.empty.noMatchHint}</p>
      {none ? (
        <Button variant="primary" onClick={() => useDialogs.getState().openAdd('file')}>
          {t.empty.add}
        </Button>
      ) : (
        <Button
          onClick={() => {
            useUi.getState().setSearch('')
            useUi.getState().setFilter(ALL_FILTER)
          }}
        >
          {t.empty.reset}
        </Button>
      )}
    </div>
  )
}
