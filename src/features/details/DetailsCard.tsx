import { ChevronDown, ChevronUp, Folder, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../api/client'
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
import { FilesTab } from './FilesTab'
import { InfoTab } from './InfoTab'
import { PeersTab } from './PeersTab'
import { PieceMap } from './PieceMap'
import { TrackersTab } from './TrackersTab'
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
  // Trackers and peers put their toolbar on the line of the tabs.
  const [tabTools, setTabTools] = useState<HTMLElement | null>(null)
  const data = useDetailsPolling(torrent ? hash : null, tab)
  if (!torrent || hash === null) return null

  const status = uiStatus(torrent)
  const progress = Math.min(1, Math.max(0, num(torrent.progress)))
  const percent = Math.floor(progress * 100)
  const resume = status.action === 'start'
  const hashes = [hash]
  // Swarm size as the trackers report it; both are -1 until a tracker has answered.
  const complete = Number.isFinite(torrent.num_complete) ? torrent.num_complete : -1
  const incomplete = Number.isFinite(torrent.num_incomplete) ? torrent.num_incomplete : -1
  const swarm = complete < 0 && incomplete < 0 ? null : Math.max(0, complete) + Math.max(0, incomplete)

  return (
    <section className={styles.card} aria-label={t.details.label} data-details tabIndex={-1}>
      <div className={styles.top}>
        <PieceMap pieces={data.pieces} />
        <div className={styles.main}>
          <div className={styles.titleRow}>
            <h2 className={styles.title} title={torrent.name}>
              {torrent.name}
            </h2>
            <Button className={styles.pause} onClick={() => void runTorrentAction(resume ? 'torrents/start' : 'torrents/stop', hashes)}>
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
        <Tabs<DetailsTab> tabs={TABS} value={tab} onChange={setTab} aria-label={t.details.tabsLabel} idPrefix="details" />
        <div ref={setTabTools} className={styles.tabTools} />
      </div>
      <div className={styles.body} role="tabpanel" id="details-panel" aria-labelledby={`details-tab-${tab}`} data-tab={tab}>
        {tab === 'files' && data.files && (
          <FilesTab
            key={hash}
            files={data.files}
            variant="desktop"
            onSetPriority={async (ids, priority) => {
              await api.post('torrents/filePrio', { hash, id: ids.join('|'), priority })
            }}
          />
        )}
        {tab === 'trackers' && (
          <TrackersTab
            key={hash}
            trackers={data.trackers}
            variant="desktop"
            toolbarTarget={tabTools}
            onAdd={async (urls) => {
              await api.post('torrents/addTrackers', { hash, urls: urls.join('\n') })
            }}
            onRemove={async (url) => {
              await api.post('torrents/removeTrackers', { hash, urls: url })
            }}
          />
        )}
        {tab === 'peers' && <PeersTab key={hash} peers={data.peers} swarm={swarm} variant="desktop" toolbarTarget={tabTools} />}
        {tab === 'info' && <InfoTab properties={data.properties} torrent={torrent} variant="desktop" />}
      </div>
    </section>
  )
}
