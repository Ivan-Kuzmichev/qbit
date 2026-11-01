import { ChevronLeft, Folder, Pause, Play, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { Chip } from '../../components/ui/Chip'
import { Progress } from '../../components/ui/Progress'
import { Tabs } from '../../components/ui/Tabs'
import { t } from '../../i18n'
import { formatBytes, formatEta, formatSpeed, percentOf, plural } from '../../lib/format'
import { navigate } from '../../lib/router'
import { useDialogs } from '../../store/dialogs'
import { useTorrents } from '../../store/torrents'
import { FilesTab } from '../details/FilesTab'
import { InfoTab } from '../details/InfoTab'
import { PeersTab } from '../details/PeersTab'
import { PieceMap } from '../details/PieceMap'
import { TrackersTab } from '../details/TrackersTab'
import type { TreeNode } from '../details/fileTree'
import { useDetailsPolling, type DetailsTab } from '../details/useDetailsPolling'
import { runTorrentAction } from '../torrents/actions'
import { uiStatus } from '../torrents/status'
import { ActionSheet } from './ActionSheet'
import styles from './MobileDetail.module.css'

const num = (n: number | undefined) => (Number.isFinite(n) ? (n as number) : 0)

const TABS: readonly { id: DetailsTab; label: string }[] = [
  { id: 'files', label: t.details.tabFiles },
  { id: 'trackers', label: t.details.tabTrackers },
  { id: 'peers', label: t.details.tabPeers },
  { id: 'info', label: t.details.tabInfo },
]

const PRIORITIES = [0, 1, 6, 7] as const

/** The screen of one torrent, `#/torrent/<hash>`. */
export function MobileDetail({ hash }: { hash: string }) {
  const torrent = useTorrents((s) => s.torrents[hash])
  // Before the first sync the list is empty: that is "not loaded yet", not "removed".
  const synced = useTorrents((s) => s.rid > 0)
  const [tab, setTab] = useState<DetailsTab>('files')
  const [picking, setPicking] = useState<{ node: TreeNode; apply: (ids: number[], priority: number) => void } | null>(null)
  const data = useDetailsPolling(torrent ? hash : null, tab)

  useEffect(() => {
    if (synced && !torrent) navigate('/')
  }, [synced, torrent])

  const header = (
    <div className={styles.bar}>
      <button type="button" className={styles.icon} aria-label={t.mobile.back} onClick={() => navigate('/')}>
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <span className={styles.barTitle}>{t.mobile.torrent}</span>
      {torrent && (
        <div className={styles.barActions}>
          <button type="button" className={styles.icon} aria-label={t.details.move} onClick={() => useDialogs.getState().openMove([hash])}>
            <Folder size={17} aria-hidden="true" />
          </button>
          <button type="button" className={`${styles.icon} ${styles.danger}`} aria-label={t.details.remove} onClick={() => useDialogs.getState().openDelete([hash])}>
            <Trash2 size={17} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
  if (!torrent) return <div className={styles.screen}>{header}</div>

  const status = uiStatus(torrent)
  const progress = Math.min(1, Math.max(0, num(torrent.progress)))
  const percent = percentOf(progress)
  const resume = status.action === 'start'
  const complete = Number.isFinite(torrent.num_complete) ? torrent.num_complete : -1
  const incomplete = Number.isFinite(torrent.num_incomplete) ? torrent.num_incomplete : -1
  const swarm = complete < 0 && incomplete < 0 ? null : Math.max(0, complete) + Math.max(0, incomplete)
  const stats: [string, string][] = [
    [t.mobile.stats.down, formatSpeed(num(torrent.dlspeed))],
    [t.mobile.stats.up, formatSpeed(num(torrent.upspeed))],
    [t.mobile.stats.left, formatEta(num(torrent.eta))],
    [t.mobile.stats.done, formatBytes(num(torrent.completed))],
    [t.mobile.stats.sent, formatBytes(num(torrent.uploaded))],
    [t.mobile.stats.ratio, num(torrent.ratio).toFixed(2)],
  ]

  const setPriority = (ids: number[], priority: number) =>
    api.post('torrents/filePrio', { hash, id: ids.join('|'), priority }).then(() => {})

  return (
    <div className={styles.screen}>
      {header}
      <div className={styles.scroll}>
        <div className={styles.top}>
          <PieceMap pieces={data.pieces} />
          <div className={styles.main}>
            <h1 className={styles.name}>{torrent.name}</h1>
            <div className={styles.chips}>
              <Chip tone="solid">{t.status[status.kind]}</Chip>
              <Chip>{plural(num(torrent.num_seeds) + num(torrent.num_leechs), t.plural.peers)}</Chip>
              <Chip>{formatBytes(num(torrent.size))}</Chip>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.progress}>
            <div className={styles.barFill}>
              <Progress value={progress} tone="accent" height={14} aria-label={`${percent}%`} />
            </div>
            <span className={styles.percent}>{percent}%</span>
          </div>
          <dl className={styles.stats}>
            {stats.map(([k, v]) => (
              <div key={k} className={styles.stat}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className={styles.tabs}>
          <Tabs<DetailsTab> tabs={TABS} value={tab} onChange={setTab} aria-label={t.details.tabsLabel} idPrefix="details" />
        </div>
        <div className={styles.panel} role="tabpanel" id="details-panel" aria-labelledby={`details-tab-${tab}`} data-tab={tab}>
          {tab === 'files' && data.files && (
            <FilesTab key={hash} files={data.files} variant="mobile" onSetPriority={setPriority} onPickPriority={(node, apply) => setPicking({ node, apply })} />
          )}
          {tab === 'trackers' && (
            <TrackersTab
              key={hash}
              trackers={data.trackers}
              variant="mobile"
              onAdd={async (urls) => {
                await api.post('torrents/addTrackers', { hash, urls: urls.join('\n') })
              }}
              onRemove={async (url) => {
                await api.post('torrents/removeTrackers', { hash, urls: url })
              }}
            />
          )}
          {tab === 'peers' && <PeersTab key={hash} peers={data.peers} swarm={swarm} variant="mobile" />}
          {tab === 'info' && <InfoTab properties={data.properties} torrent={torrent} variant="mobile" />}
        </div>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.toggle} onClick={() => void runTorrentAction(resume ? 'torrents/start' : 'torrents/stop', [hash])}>
          {resume ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
          {resume ? t.details.resume : t.details.pause}
        </button>
      </div>

      {picking && (
        <ActionSheet
          title={`${t.mobile.priorityTitle}: ${picking.node.name}`}
          items={PRIORITIES.map((p) => ({
            id: String(p),
            label: t.details.files.priorities[p],
            checked: picking.node.priority === p,
            onSelect: () => {
              const { node, apply } = picking
              setPicking(null)
              apply(node.ids, p)
            },
          }))}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  )
}
