import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { Preferences } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Toggle } from '../../components/ui/Toggle'
import { t } from '../../i18n'
import { formatLimitSpeed } from '../../lib/format'
import { useRoute } from '../../lib/router'
import { loadVersions } from '../auth/versions'
import { logOut } from '../settings/logout'
import { sections, type Row } from '../settings/schema'
import { SettingRow } from '../settings/SettingRow'
import { useSettingsDraft } from '../settings/useSettingsDraft'
import styles from './MobileSettings.module.css'
import { SettingEditSheet } from './SettingEditSheet'

const m = t.mobile
const allRows: Row[] = sections.flatMap((s) => s.cards.flatMap((c) => c.rows))
const rowOf = (key: string): Row => allRows.find((r) => r.key === key)!

const pad = (n: number) => String(n).padStart(2, '0')
const limit = (bytes: number) => (bytes > 0 ? formatLimitSpeed(bytes) : '∞')
const ratio = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(Math.round(n * 100) / 100))
const minutes = (n: number) => (n >= 60 && n % 60 === 0 ? `${n / 60} ${t.eta.hours}` : `${n} ${t.eta.minutes}`)

type Item =
  | { type: 'toggle'; key: keyof Preferences; label: string; toggleValues?: [number, number]; visible?(d: Preferences): boolean }
  | { type: 'value'; label: string; rows: string[]; value(d: Preferences): string; visible?(d: Preferences): boolean }

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: m.groups.saving,
    items: [
      { type: 'value', label: rowOf('save_path').label, rows: ['save_path'], value: (d) => d.save_path },
      { type: 'toggle', key: 'temp_path_enabled', label: m.rows.tempPath },
      {
        type: 'value',
        label: m.rows.tempPathValue,
        rows: ['temp_path'],
        value: (d) => d.temp_path,
        visible: (d) => d.temp_path_enabled,
      },
      { type: 'toggle', key: 'add_stopped_enabled', label: rowOf('add_stopped_enabled').label },
      { type: 'toggle', key: 'auto_delete_mode', label: rowOf('auto_delete_mode').label, toggleValues: [0, 1] },
    ],
  },
  {
    title: m.groups.speed,
    items: [
      { type: 'value', label: rowOf('dl_limit').label, rows: ['dl_limit'], value: (d) => limit(d.dl_limit) },
      { type: 'value', label: rowOf('up_limit').label, rows: ['up_limit'], value: (d) => limit(d.up_limit) },
      { type: 'value', label: rowOf('alt_dl_limit').label, rows: ['alt_dl_limit'], value: (d) => limit(d.alt_dl_limit) },
      { type: 'value', label: rowOf('alt_up_limit').label, rows: ['alt_up_limit'], value: (d) => limit(d.alt_up_limit) },
      { type: 'toggle', key: 'scheduler_enabled', label: m.rows.schedule },
      {
        type: 'value',
        label: m.rows.scheduleWindow,
        rows: ['schedule_from_hour', 'scheduler_days'],
        value: (d) =>
          `${pad(d.schedule_from_hour)}:${pad(d.schedule_from_min)}–${pad(d.schedule_to_hour)}:${pad(d.schedule_to_min)}`,
        visible: (d) => d.scheduler_enabled,
      },
    ],
  },
  {
    title: m.groups.seeding,
    items: [
      {
        type: 'value',
        label: m.rows.ratio,
        rows: ['max_ratio_enabled', 'max_ratio'],
        value: (d) => (d.max_ratio_enabled ? ratio(d.max_ratio) : m.off),
      },
      {
        type: 'value',
        label: m.rows.seedTime,
        rows: ['max_seeding_time_enabled', 'max_seeding_time'],
        value: (d) => (d.max_seeding_time_enabled ? minutes(d.max_seeding_time) : m.off),
      },
    ],
  },
]

/** Sections that open as a full-screen list from "Ещё". */
const MORE = ['connection', 'bittorrent', 'webui', 'notifications', 'appearance'] as const

function Chevron() {
  return <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
}

interface Editing {
  title: string
  rows: Row[]
}

export function MobileSettings() {
  const { path, navigate } = useRoute()
  const s = useSettingsDraft()
  const [editing, setEditing] = useState<Editing | null>(null)

  const requested = path.split('/')[2]
  const sub = MORE.find((id) => id === requested)
  const section = sub ? sections.find((x) => x.id === sub)! : null
  const draft = s.draft

  const header = (
    <div className={styles.bar}>
      <button type="button" className={styles.back} aria-label={m.back} onClick={() => navigate(sub ? '/settings' : '/')}>
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <h1 className={styles.title}>{section ? section.title : t.settings.title}</h1>
      <button type="button" className={styles.save} disabled={!s.canSave} onClick={() => void s.save()}>
        {t.settings.save}
      </button>
    </div>
  )

  let body = null
  if (s.status === 'loading') body = <div role="status" className={styles.note}>{t.settings.loading}</div>
  else if (s.status === 'error')
    body = (
      <div role="alert" className={styles.note}>
        {t.settings.loadFailed}
        <Button size="sm" onClick={s.load}>
          {t.settings.retry}
        </Button>
      </div>
    )
  else if (draft && section)
    body = (
      <div className={styles.groups}>
        {section.cards.map((card) => (
          <section key={card.title} className={styles.group}>
            <h2 className={styles.groupTitle}>{card.title}</h2>
            <div className={styles.list}>
              {card.rows.map((row) => (
                <SettingRow key={`${row.key}:${s.version}`} row={row} draft={draft} set={s.set} setInvalid={s.setInvalid} />
              ))}
            </div>
          </section>
        ))}
      </div>
    )
  else if (draft) {
    const known = loadVersions()
    const version = [
      `${t.app.name} v${__APP_VERSION__}`,
      ...(known ? [`${t.app.qbittorrent} ${known.app}`, `${t.app.webApi} ${known.api}`] : []),
    ].join(' · ')
    body = (
      <div className={styles.groups}>
        {GROUPS.map((g) => (
          <section key={g.title} className={styles.group}>
            <h2 className={styles.groupTitle}>{g.title}</h2>
            <div className={styles.list}>
              {g.items.map((item) => {
                if (item.visible && !item.visible(draft)) return null
                if (item.type === 'toggle') {
                  const [off, on] = item.toggleValues ?? [0, 1]
                  const checked = item.toggleValues ? draft[item.key] === on : Boolean(draft[item.key])
                  return (
                    <div key={item.key} className={styles.item}>
                      <span className={styles.label}>{item.label}</span>
                      <Toggle
                        aria-label={item.label}
                        checked={checked}
                        onChange={(v) => s.set(item.key, (item.toggleValues ? (v ? on : off) : v) as never)}
                      />
                    </div>
                  )
                }
                return (
                  <button
                    key={item.label}
                    type="button"
                    className={styles.item}
                    onClick={() => setEditing({ title: item.label, rows: item.rows.map(rowOf) })}
                  >
                    <span className={styles.label}>{item.label}</span>
                    <span className={styles.value}>{item.value(draft)}</span>
                    <Chevron />
                  </button>
                )
              })}
            </div>
          </section>
        ))}
        <section className={styles.group}>
          <h2 className={styles.groupTitle}>{m.groups.more}</h2>
          <div className={styles.list}>
            {MORE.map((id) => (
              <button key={id} type="button" className={styles.item} onClick={() => navigate(`/settings/${id}`)}>
                <span className={styles.label}>{sections.find((x) => x.id === id)!.title}</span>
                <Chevron />
              </button>
            ))}
            <button type="button" className={`${styles.item} ${styles.logout}`} onClick={() => s.confirmLeave(() => void logOut())}>
              <span className={styles.label}>{t.settings.logout}</span>
            </button>
          </div>
        </section>
        <p className={styles.version}>{version}</p>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      {header}
      <div className={styles.scroll}>{body}</div>

      {editing && draft && (
        <SettingEditSheet
          title={editing.title}
          rows={editing.rows}
          draft={draft}
          set={s.set}
          setInvalid={s.setInvalid}
          onClose={() => setEditing(null)}
        />
      )}
      {s.leaving && (
        <Dialog title={t.settings.leaveTitle} onClose={s.stay} width={400}>
          <p className={styles.leaveBody}>{t.settings.leaveBody}</p>
          <div className={styles.leaveActions}>
            <Button onClick={s.stay}>{t.settings.stay}</Button>
            <Button variant="danger" onClick={s.leave}>
              {t.settings.leave}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
