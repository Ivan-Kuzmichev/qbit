import { ChevronDown, ChevronUp, Folder, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Chip } from '../../components/ui/Chip'
import { IconButton } from '../../components/ui/IconButton'
import { Progress } from '../../components/ui/Progress'
import { Tabs } from '../../components/ui/Tabs'
import { t } from '../../i18n/ru'
import { formatBytes, formatEta, formatSpeed, plural } from '../../lib/format'
import { useDialogs } from '../../store/dialogs'
import { useTorrents } from '../../store/torrents'
import { runTorrentAction } from '../torrents/actions'
import { uiStatus } from '../torrents/status'
import styles from './DetailsCard.module.css'
import { PieceMap } from './PieceMap'
import { useDetailsPolling, type DetailsTab } from './useDetailsPolling'

const num = (n: number | undefined) => (Number.isFinite(n) ? (n as number) : 0)

const TABS: readonly { id: DetailsTab; label: string }[] = [
  { id: 'files', label: t.details.tabFiles },
  { id: 'trackers', label: t.details.tabTrackers },
  { id: 'peers', label: t.details.tabPeers },
  { id: 'info', label: t.details.tabInfo },
]

/** Shown under the table while exactly one existing torrent is selected. */
export function DetailsCard() {
  const hash = useTorrents((s) => (s.selected.size === 1 ? [...s.selected][0] : null))
  const torrent = useTorrents((s) => (hash !== null ? s.torrents[hash] : undefined))
  const [tab, setTab] = useState<DetailsTab>('files')
  const data = useDetailsPolling(torrent ? hash : null, tab)
  if (!torrent || hash === null) return null

  const status = uiStatus(torrent)
  const progress = Math.min(1, Math.max(0, num(torrent.progress)))
  const percent = Math.floor(progress * 100)
  const resume = status.action === 'start'
  const hashes = [hash]

  return (
    <section className={styles.card} aria-label={t.details.label}>
      <div className={styles.top}>
        <PieceMap pieces={data.pieces} />
        <div className={styles.main}>
          <div className={styles.titleRow}>
            <h2 className={styles.title} title={torrent.name}>
              {torrent.name}
            </h2>
            <Button onClick={() => void runTorrentAction(resume ? 'torrents/start' : 'torrents/stop', hashes)}>
              {resume ? t.details.resume : t.details.pause}
            </Button>
          </div>
          <div className={styles.chips}>
            <Chip tone="solid">{t.status[status.kind]}</Chip>
            {data.files && <Chip>{plural(data.files.length, t.details.fileForms)}</Chip>}
            <Chip>{plural(num(torrent.num_seeds) + num(torrent.num_leechs), t.plural.peers)}</Chip>
            <Chip>{formatBytes(num(torrent.size))}</Chip>
          </div>
          <div className={styles.progressRow}>
            <div className={styles.bar}>
              <Progress value={progress} tone="accent" height={14} aria-label={`${percent}%`} />
            </div>
            <span className={styles.percent}>{percent}%</span>
            <div className={styles.icons}>
              <IconButton aria-label={t.details.move} onClick={() => useDialogs.getState().openMove(hashes)}>
                <Folder size={15} strokeWidth={2} aria-hidden="true" />
              </IconButton>
              <IconButton aria-label={t.details.queueUp} onClick={() => void runTorrentAction('torrents/increasePrio', hashes)}>
                <ChevronUp size={15} strokeWidth={2} aria-hidden="true" />
              </IconButton>
              <IconButton aria-label={t.details.queueDown} onClick={() => void runTorrentAction('torrents/decreasePrio', hashes)}>
                <ChevronDown size={15} strokeWidth={2} aria-hidden="true" />
              </IconButton>
              <IconButton
                className={styles.danger}
                aria-label={t.details.remove}
                onClick={() => useDialogs.getState().openDelete(hashes)}
              >
                <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
              </IconButton>
            </div>
          </div>
          <div className={styles.stats}>
            <span>
              ↓ <b>{formatSpeed(num(torrent.dlspeed))}</b>
            </span>
            <span>
              ↑ <b>{formatSpeed(num(torrent.upspeed))}</b>
            </span>
            <span>
              {t.details.remaining} <b>{formatEta(num(torrent.eta))}</b>
            </span>
            <span>
              {t.details.downloaded}{' '}
              <b>
                {formatBytes(num(torrent.completed))} {t.details.of} {formatBytes(num(torrent.size))}
              </b>
            </span>
            <span>
              {t.details.uploaded} <b>{formatBytes(num(torrent.uploaded))}</b>
            </span>
          </div>
        </div>
      </div>
      <div className={styles.tabs}>
        <Tabs<DetailsTab> tabs={TABS} value={tab} onChange={setTab} aria-label={t.details.tabsLabel} />
      </div>
      {/* Tasks 14 and 15 fill the tab bodies from `data`. */}
      <div className={styles.body} role="tabpanel" data-tab={tab} />
    </section>
  )
}
