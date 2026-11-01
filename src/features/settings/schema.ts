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

const switchedBy = (key: keyof Preferences) => (p: Preferences) => Boolean(p[key])

const encryption = [
  { value: 0, label: 'Разрешить' },
  { value: 1, label: 'Требовать' },
  { value: 2, label: 'Отключить' },
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

const slots = (key: keyof Preferences, label: string, hint?: string): Row => ({
  key,
  kind: 'number',
  label,
  hint,
  min: 0,
  unlimited: true,
})

export const sections: Section[] = [
  {
    id: 'downloads',
    title: s.sections.downloads,
    cards: [
      {
        title: 'Сохранение',
        desc: 'Куда и как складывать файлы',
        rows: [
          { key: 'save_path', kind: 'text', label: 'Папка по умолчанию', hint: 'Для торрентов без категории' },
          {
            key: 'temp_path_enabled',
            kind: 'toggle',
            label: 'Отдельная папка для незавершённых',
            hint: 'Файлы переедут в основную после загрузки',
          },
          {
            key: 'temp_path',
            kind: 'text',
            label: 'Папка для незавершённых',
            enabledBy: 'temp_path_enabled',
            visibleIf: switchedBy('temp_path_enabled'),
          },
          { key: 'add_stopped_enabled', kind: 'toggle', label: 'Добавлять на паузе', hint: 'Не начинать загрузку сразу' },
          { key: 'auto_delete_mode', kind: 'toggle', label: 'Удалять .torrent после добавления', toggleValues: [0, 1] },
        ],
      },
      {
        title: 'Раздача',
        desc: 'Когда прекращать раздачу',
        rows: [
          { key: 'max_ratio_enabled', kind: 'toggle', label: 'Останавливать при ratio' },
          {
            key: 'max_ratio',
            kind: 'number',
            label: 'Ratio',
            min: 0,
            decimal: true,
            enabledBy: 'max_ratio_enabled',
            visibleIf: switchedBy('max_ratio_enabled'),
          },
          { key: 'max_seeding_time_enabled', kind: 'toggle', label: 'Останавливать после времени раздачи' },
          {
            key: 'max_seeding_time',
            kind: 'number',
            label: 'Время раздачи',
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
        title: 'Порт',
        desc: 'Входящие соединения',
        rows: [
          { key: 'listen_port', kind: 'number', label: 'Порт входящих соединений', min: 0, max: 65535 },
          { key: 'upnp', kind: 'toggle', label: 'UPnP / NAT-PMP', hint: 'Автоматически пробрасывать порт на роутере' },
        ],
      },
      {
        title: 'Лимиты соединений',
        desc: s.unlimitedHint,
        rows: [
          slots('max_connec', 'Всего соединений'),
          slots('max_connec_per_torrent', 'Соединений на торрент'),
          slots('max_uploads', 'Слотов отдачи всего'),
          slots('max_uploads_per_torrent', 'Слотов отдачи на торрент'),
        ],
      },
    ],
  },
  {
    id: 'speed',
    title: s.sections.speed,
    cards: [
      {
        title: 'Глобальные лимиты',
        desc: '0 — без ограничений',
        rows: [
          { key: 'dl_limit', kind: 'limit', label: 'Лимит загрузки', unit: s.units.kbs },
          { key: 'up_limit', kind: 'limit', label: 'Лимит отдачи', unit: s.units.kbs },
        ],
      },
      {
        title: 'Альтернативные лимиты',
        desc: 'Включаются кнопкой в боковой панели или по расписанию',
        rows: [
          { key: 'alt_dl_limit', kind: 'limit', label: 'Альт. лимит загрузки', unit: s.units.kbs },
          { key: 'alt_up_limit', kind: 'limit', label: 'Альт. лимит отдачи', unit: s.units.kbs },
        ],
      },
      {
        title: 'Расписание',
        desc: 'Когда включать альтернативные лимиты',
        rows: [
          { key: 'scheduler_enabled', kind: 'toggle', label: 'Включать по расписанию' },
          {
            key: 'schedule_from_hour',
            kind: 'schedule',
            label: 'Время',
            visibleIf: switchedBy('scheduler_enabled'),
          },
          {
            key: 'scheduler_days',
            kind: 'select',
            label: 'Дни',
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
        title: 'Поиск пиров',
        desc: 'Как находить других участников раздачи',
        rows: [
          { key: 'dht', kind: 'toggle', label: 'DHT' },
          { key: 'pex', kind: 'toggle', label: 'PeX', hint: 'Обмен списками пиров' },
          { key: 'lsd', kind: 'toggle', label: 'LSD', hint: 'Поиск пиров в локальной сети' },
          { key: 'encryption', kind: 'select', label: 'Шифрование', options: encryption },
          { key: 'anonymous_mode', kind: 'toggle', label: 'Анонимный режим' },
        ],
      },
      {
        title: 'Очередь',
        desc: 'Сколько торрентов работает одновременно',
        rows: [
          { key: 'queueing_enabled', kind: 'toggle', label: 'Очередь торрентов' },
          { ...slots('max_active_downloads', 'Активных загрузок'), visibleIf: switchedBy('queueing_enabled') },
          { ...slots('max_active_uploads', 'Активных раздач'), visibleIf: switchedBy('queueing_enabled') },
          { ...slots('max_active_torrents', 'Активных торрентов'), visibleIf: switchedBy('queueing_enabled') },
        ],
      },
    ],
  },
  {
    id: 'webui',
    title: s.sections.webui,
    cards: [
      {
        title: 'Доступ',
        desc: 'Логин и пароль для входа в WebUI',
        rows: [
          { key: 'web_ui_username', kind: 'text', label: 'Логин' },
          { key: 'web_ui_password', kind: 'password', label: 'Новый пароль', hint: 'Оставьте пустым, чтобы не менять' },
        ],
      },
      {
        title: 'Обход авторизации',
        desc: 'Без входа с доверенных адресов',
        rows: [
          { key: 'bypass_local_auth', kind: 'toggle', label: 'Не требовать вход с localhost' },
          { key: 'bypass_auth_subnet_whitelist_enabled', kind: 'toggle', label: 'Не требовать вход для подсетей' },
          {
            key: 'bypass_auth_subnet_whitelist',
            kind: 'text',
            label: 'Подсети',
            hint: 'CIDR через запятую, например 192.168.1.0/24',
            enabledBy: 'bypass_auth_subnet_whitelist_enabled',
            visibleIf: switchedBy('bypass_auth_subnet_whitelist_enabled'),
          },
        ],
      },
      {
        title: 'Пиры',
        desc: 'Отображение в списке пиров',
        rows: [{ key: 'resolve_peer_countries', kind: 'toggle', label: 'Определять страны пиров' }],
      },
    ],
  },
  {
    id: 'appearance',
    title: s.sections.appearance,
    cards: [
      {
        title: s.accentLabel,
        desc: 'Хранится в этом браузере, не в qBittorrent',
        rows: [{ key: 'accent', kind: 'accent', label: s.accentLabel }],
      },
    ],
  },
]

export const sectionIds = sections.map((x) => x.id)
