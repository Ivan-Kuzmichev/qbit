import type { Preferences } from '../../api/types'
import { t } from '../../i18n/ru'

export type RowKind = 'toggle' | 'text' | 'number' | 'limit' | 'select' | 'password' | 'schedule' | 'accent'

export interface Row {
  /** Preference key; 'accent' for the local-only accent row. */
  key: keyof Preferences | 'accent'
  kind: RowKind
  label: string
  hint?: string
  unit?: string
  /** Toggle backed by a number: [off, on]. */
  toggleValues?: [number, number]
  /** number: allowed range, integer unless `decimal`. */
  min?: number
  max?: number
  decimal?: boolean
  /** number: empty or ∞ is stored as -1. */
  unlimited?: boolean
  options?: readonly { value: number; label: string }[]
  /** Hidden (and not sent) while this switch is off. */
  enabledBy?: keyof Preferences
  visibleIf?: (draft: Preferences) => boolean
}

export interface Card {
  title: string
  desc: string
  rows: Row[]
}

export interface Section {
  id: string
  title: string
  cards: Card[]
}

export const ACCENT_PRESETS = ['#60A5FA', '#A78BFA', '#22D3EE', '#FBBF24'] as const

const s = t.settings
const d = s.days
const R = s.schema.rows
const C = s.schema.cards

const switchedBy = (key: keyof Preferences) => (p: Preferences) => Boolean(p[key])

const encryption = [
  { value: 0, label: s.schema.encryption.allow },
  { value: 1, label: s.schema.encryption.require },
  { value: 2, label: s.schema.encryption.disable },
] as const

const days = [
  { value: 0, label: d.all },
  { value: 1, label: d.weekdays },
  { value: 2, label: d.weekends },
  { value: 3, label: d.mon },
  { value: 4, label: d.tue },
  { value: 5, label: d.wed },
  { value: 6, label: d.thu },
  { value: 7, label: d.fri },
  { value: 8, label: d.sat },
  { value: 9, label: d.sun },
] as const

type SlotKey = 'max_connec' | 'max_connec_per_torrent' | 'max_uploads' | 'max_uploads_per_torrent' | 'max_active_downloads' | 'max_active_uploads' | 'max_active_torrents'

const slots = (key: keyof Preferences): Row => ({
  key,
  kind: 'number',
  label: R[key as SlotKey].label,
  min: 0,
  unlimited: true,
})

export const sections: Section[] = [
  {
    id: 'downloads',
    title: s.sections.downloads,
    cards: [
      {
        title: C.saving.title,
        desc: C.saving.desc,
        rows: [
          { key: 'save_path', kind: 'text', label: R.save_path.label, hint: R.save_path.hint },
          {
            key: 'temp_path_enabled',
            kind: 'toggle',
            label: R.temp_path_enabled.label,
            hint: R.temp_path_enabled.hint,
          },
          {
            key: 'temp_path',
            kind: 'text',
            label: R.temp_path.label,
            enabledBy: 'temp_path_enabled',
            visibleIf: switchedBy('temp_path_enabled'),
          },
          { key: 'add_stopped_enabled', kind: 'toggle', label: R.add_stopped_enabled.label, hint: R.add_stopped_enabled.hint },
          { key: 'auto_delete_mode', kind: 'toggle', label: R.auto_delete_mode.label, toggleValues: [0, 1] },
        ],
      },
      {
        title: C.seeding.title,
        desc: C.seeding.desc,
        rows: [
          { key: 'max_ratio_enabled', kind: 'toggle', label: R.max_ratio_enabled.label },
          {
            key: 'max_ratio',
            kind: 'number',
            label: R.max_ratio.label,
            min: 0,
            decimal: true,
            enabledBy: 'max_ratio_enabled',
            visibleIf: switchedBy('max_ratio_enabled'),
          },
          { key: 'max_seeding_time_enabled', kind: 'toggle', label: R.max_seeding_time_enabled.label },
          {
            key: 'max_seeding_time',
            kind: 'number',
            label: R.max_seeding_time.label,
            unit: s.units.min,
            min: 0,
            enabledBy: 'max_seeding_time_enabled',
            visibleIf: switchedBy('max_seeding_time_enabled'),
          },
        ],
      },
    ],
  },
  {
    id: 'connection',
    title: s.sections.connection,
    cards: [
      {
        title: C.port.title,
        desc: C.port.desc,
        rows: [
          { key: 'listen_port', kind: 'number', label: R.listen_port.label, min: 0, max: 65535 },
          { key: 'upnp', kind: 'toggle', label: R.upnp.label, hint: R.upnp.hint },
        ],
      },
      {
        title: C.connLimits.title,
        desc: s.unlimitedHint,
        rows: [
          slots('max_connec'),
          slots('max_connec_per_torrent'),
          slots('max_uploads'),
          slots('max_uploads_per_torrent'),
        ],
      },
    ],
  },
  {
    id: 'speed',
    title: s.sections.speed,
    cards: [
      {
        title: C.globalLimits.title,
        desc: C.globalLimits.desc,
        rows: [
          { key: 'dl_limit', kind: 'limit', label: R.dl_limit.label, unit: s.units.kbs },
          { key: 'up_limit', kind: 'limit', label: R.up_limit.label, unit: s.units.kbs },
        ],
      },
      {
        title: C.altLimits.title,
        desc: C.altLimits.desc,
        rows: [
          { key: 'alt_dl_limit', kind: 'limit', label: R.alt_dl_limit.label, unit: s.units.kbs },
          { key: 'alt_up_limit', kind: 'limit', label: R.alt_up_limit.label, unit: s.units.kbs },
        ],
      },
      {
        title: C.schedule.title,
        desc: C.schedule.desc,
        rows: [
          { key: 'scheduler_enabled', kind: 'toggle', label: R.scheduler_enabled.label },
          {
            key: 'schedule_from_hour',
            kind: 'schedule',
            label: R.schedule_from_hour.label,
            visibleIf: switchedBy('scheduler_enabled'),
          },
          {
            key: 'scheduler_days',
            kind: 'select',
            label: R.scheduler_days.label,
            options: days,
            visibleIf: switchedBy('scheduler_enabled'),
          },
        ],
      },
    ],
  },
  {
    id: 'bittorrent',
    title: s.sections.bittorrent,
    cards: [
      {
        title: C.peerSearch.title,
        desc: C.peerSearch.desc,
        rows: [
          { key: 'dht', kind: 'toggle', label: R.dht.label },
          { key: 'pex', kind: 'toggle', label: R.pex.label, hint: R.pex.hint },
          { key: 'lsd', kind: 'toggle', label: R.lsd.label, hint: R.lsd.hint },
          { key: 'encryption', kind: 'select', label: R.encryption.label, options: encryption },
          { key: 'anonymous_mode', kind: 'toggle', label: R.anonymous_mode.label },
        ],
      },
      {
        title: C.queue.title,
        desc: C.queue.desc,
        rows: [
          { key: 'queueing_enabled', kind: 'toggle', label: R.queueing_enabled.label },
          { ...slots('max_active_downloads'), visibleIf: switchedBy('queueing_enabled') },
          { ...slots('max_active_uploads'), visibleIf: switchedBy('queueing_enabled') },
          { ...slots('max_active_torrents'), visibleIf: switchedBy('queueing_enabled') },
        ],
      },
    ],
  },
  {
    id: 'webui',
    title: s.sections.webui,
    cards: [
      {
        title: C.access.title,
        desc: C.access.desc,
        rows: [
          { key: 'web_ui_username', kind: 'text', label: R.web_ui_username.label },
          { key: 'web_ui_password', kind: 'password', label: R.web_ui_password.label, hint: R.web_ui_password.hint },
        ],
      },
      {
        title: C.bypass.title,
        desc: C.bypass.desc,
        rows: [
          { key: 'bypass_local_auth', kind: 'toggle', label: R.bypass_local_auth.label },
          { key: 'bypass_auth_subnet_whitelist_enabled', kind: 'toggle', label: R.bypass_auth_subnet_whitelist_enabled.label },
          {
            key: 'bypass_auth_subnet_whitelist',
            kind: 'text',
            label: R.bypass_auth_subnet_whitelist.label,
            hint: R.bypass_auth_subnet_whitelist.hint,
            enabledBy: 'bypass_auth_subnet_whitelist_enabled',
            visibleIf: switchedBy('bypass_auth_subnet_whitelist_enabled'),
          },
        ],
      },
      {
        title: C.peers.title,
        desc: C.peers.desc,
        rows: [{ key: 'resolve_peer_countries', kind: 'toggle', label: R.resolve_peer_countries.label }],
      },
    ],
  },
  {
    id: 'appearance',
    title: s.sections.appearance,
    cards: [
      {
        title: s.accentLabel,
        desc: C.appearance.desc,
        rows: [{ key: 'accent', kind: 'accent', label: s.accentLabel }],
      },
    ],
  },
]

export const sectionIds = sections.map((x) => x.id)
