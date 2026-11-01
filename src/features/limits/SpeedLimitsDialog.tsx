import { Info } from 'lucide-react'
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { api } from '../../api/client'
import type { Preferences } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Segmented } from '../../components/ui/Segmented'
import { toast } from '../../components/ui/Toast'
import { t } from '../../i18n'
import { formatLimitSpeed, plural } from '../../lib/format'
import { parseLimitMb } from '../../lib/parseNumber'
import type { LimitsTab } from '../../store/dialogs'
import { useTorrents } from '../../store/torrents'
import { runTorrentAction } from '../torrents/actions'
import styles from './SpeedLimitsDialog.module.css'

const MB = 1024 * 1024
const PRESETS = ['∞', '1', '5', '10', '50'] as const

type Dir = 'dl' | 'up'
type Draft = Partial<Record<Dir, string>>
type Limits = Record<Dir, number>

export interface SpeedLimitsDialogProps {
  tab: LimitsTab
  hashes: readonly string[]
  onClose(): void
}

/** bytes/s -> text for the field: 0 is "∞", otherwise MB with up to two decimals and a dot. */
function formatLimit(bytes: number): string {
  if (!bytes || bytes < 0) return t.limits.unlimited
  return String(Number((bytes / MB).toFixed(2)))
}

/** The text the field starts with; null when several torrents disagree. */
function torrentInitial(hashes: readonly string[]): Record<Dir, string | null> {
  const { torrents } = useTorrents.getState()
  const list = hashes.flatMap((h) => (torrents[h] ? [torrents[h]] : []))
  const one = (pick: (x: (typeof list)[number]) => number) => {
    const values = new Set(list.map((x) => pick(x) ?? 0))
    return values.size === 1 ? formatLimit([...values][0]) : null
  }
  return { dl: one((x) => x.dl_limit), up: one((x) => x.up_limit) }
}

async function saveGlobal(l: Limits) {
  await api.post('transfer/setDownloadLimit', { limit: l.dl })
  await api.post('transfer/setUploadLimit', { limit: l.up })
}

export function SpeedLimitsDialog({ tab: initialTab, hashes, onClose }: SpeedLimitsDialogProps) {
  const torrents = useTorrents((s) => s.torrents)
  const existing = useMemo(() => hashes.filter((h) => h in torrents), [hashes, torrents])
  const altOn = useTorrents((s) => Boolean(s.server.use_alt_speed_limits))
  const canTorrent = existing.length > 0
  const [chosen, setTab] = useState<LimitsTab>(initialTab)
  // the torrent can vanish while the dialog is open: its tab then falls back to the global one
  const tab: LimitsTab = chosen === 'torrent' && !canTorrent ? 'global' : chosen
  const [drafts, setDrafts] = useState<Partial<Record<LimitsTab, Draft>>>({})
  const [torrentStart] = useState(() => torrentInitial(hashes))
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const uid = useId()
  const formId = `${uid}-form`

  useEffect(() => {
    let alive = true
    api
      .get<Preferences>('app/preferences')
      .then((p) => alive && setPrefs(p))
      .catch(() => alive && setLoadFailed(true))
    return () => {
      alive = false
    }
  }, [])

  const start = (dir: Dir): string | null => {
    if (tab === 'torrent') return torrentStart[dir]
    if (!prefs) return ''
    const bytes = tab === 'global' ? (dir === 'dl' ? prefs.dl_limit : prefs.up_limit) : dir === 'dl' ? prefs.alt_dl_limit : prefs.alt_up_limit
    return formatLimit(bytes)
  }
  const text = (dir: Dir) => drafts[tab]?.[dir] ?? start(dir) ?? ''
  /** undefined: leave as is (several torrents, field untouched); null: invalid; number: bytes/s. */
  const bytes = (dir: Dir): number | null | undefined =>
    drafts[tab]?.[dir] === undefined && start(dir) === null ? undefined : parseLimitMb(text(dir))
  const setText = (dir: Dir, value: string) => setDrafts((d) => ({ ...d, [tab]: { ...d[tab], [dir]: value } }))

  const waiting = tab !== 'torrent' && !prefs
  const invalid = bytes('dl') === null || bytes('up') === null
  const canApply = !waiting && !invalid && !saving

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!canApply) return
    const dl = bytes('dl')
    const up = bytes('up')
    if (tab === 'torrent') {
      onClose()
      if (dl !== undefined) await runTorrentAction('torrents/setDownloadLimit', existing, { limit: dl! })
      if (up !== undefined) await runTorrentAction('torrents/setUploadLimit', existing, { limit: up! })
      return
    }
    setSaving(true)
    try {
      if (tab === 'global') await saveGlobal({ dl: dl!, up: up! })
      else await api.post('app/setPreferences', { json: JSON.stringify({ alt_dl_limit: dl, alt_up_limit: up }) })
    } catch {
      setSaving(false)
      toast(t.actions.failed)
      return
    }
    onClose()
    await useTorrents.getState().refresh().catch(() => {})
  }

  // The global limit that is in force now: the alternative one while alt mode is on.
  const effective: Limits | null = prefs
    ? altOn
      ? { dl: prefs.alt_dl_limit, up: prefs.alt_up_limit }
      : { dl: prefs.dl_limit, up: prefs.up_limit }
    : null
  const hints = (['dl', 'up'] as const).flatMap((dir) => {
    const own = bytes(dir)
    const global = effective?.[dir] ?? 0
    if (tab !== 'torrent' || !own || global <= 0 || global >= own) return []
    return [`${dir === 'dl' ? t.limits.hintDownload : t.limits.hintUpload} ${formatLimitSpeed(global)} ${t.limits.hintTail}`]
  })

  const subtitle =
    existing.length === 1
      ? (torrents[existing[0]]?.name ?? '')
      : `${existing.length} ${plural(existing.length, t.dialogs.torrentForms)}`

  const rows: { dir: Dir; label: string; group: string; arrow: string; arrowClass: string }[] = [
    { dir: 'dl', label: t.limits.download, group: t.limits.downloadGroup, arrow: '↓', arrowClass: styles.down },
    { dir: 'up', label: t.limits.upload, group: t.limits.uploadGroup, arrow: '↑', arrowClass: styles.up },
  ]

  return (
    <Dialog
      title={t.limits.title}
      onClose={onClose}
      width={420}
      minHeight={430}
      description={tab === 'torrent' ? subtitle : undefined}
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            {t.dialogs.cancel}
          </Button>
          <Button size="sm" variant="primary" type="submit" form={formId} disabled={!canApply}>
            {t.limits.apply}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className={styles.form}>
        <div className={styles.tabs}>
          <Segmented<LimitsTab>
            aria-label={t.limits.tabsLabel}
            value={tab}
            onChange={setTab}
            options={[
              { id: 'torrent', label: t.limits.tabTorrent, disabled: !canTorrent },
              { id: 'global', label: t.limits.tabGlobal },
              { id: 'alt', label: t.limits.tabAlt },
            ]}
          />
        </div>
        {loadFailed && tab !== 'torrent' && <p className={styles.error}>{t.limits.loadFailed}</p>}
        {rows.map((r) => {
          const id = `${uid}-${r.dir}`
          const value = bytes(r.dir)
          const bad = value === null
          return (
            <div key={r.dir} role="group" aria-label={r.group} className={styles.row}>
              <div className={styles.line}>
                <span className={styles.label}>
                  <span className={r.arrowClass} aria-hidden="true">
                    {r.arrow}
                  </span>
                  <label htmlFor={id}>{r.label}</label>
                </span>
                <span className={styles.field} data-invalid={bad || undefined}>
                  <input
                    id={id}
                    className={styles.input}
                    value={text(r.dir)}
                    onChange={(e) => setText(r.dir, e.target.value)}
                    placeholder={start(r.dir) === null ? t.limits.mixed : undefined}
                    inputMode="decimal"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={waiting}
                    aria-invalid={bad}
                    aria-describedby={bad ? `${id}-err` : undefined}
                  />
                  <span className={styles.unit}>{t.limits.unit}</span>
                </span>
              </div>
              {bad && (
                <p id={`${id}-err`} className={styles.error}>
                  {t.limits.invalid}
                </p>
              )}
              <div className={styles.presets}>
                {PRESETS.map((p) => {
                  const pressed = value !== undefined && value !== null && value === parseLimitMb(p)
                  return (
                    <button
                      key={p}
                      type="button"
                      data-preset={p}
                      className={styles.preset}
                      aria-pressed={pressed}
                      disabled={waiting}
                      onClick={() => setText(r.dir, p)}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
        {hints.map((h) => (
          <p key={h} className={styles.hint}>
            <Info size={15} aria-hidden="true" />
            <span>{h}</span>
          </p>
        ))}
      </form>
    </Dialog>
  )
}
