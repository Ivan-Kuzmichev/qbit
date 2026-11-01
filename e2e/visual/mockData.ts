import type { Page, Route } from '@playwright/test'

/**
 * The sample data of design/*.dc.html as qBittorrent API responses, so that the app shows the
 * same names, sizes, speeds and percentages as the mockups.
 */
const K = 1024
const M = K * K
const G = M * K
const T = G * K

export const HASH = 'a'.repeat(40)
const hash = (i: number) => (i === 0 ? HASH : String(i).repeat(40))

const base = {
  downloaded: 0,
  total_size: 0,
  completion_on: 0,
  save_path: '/downloads/',
  category: '',
  tags: '',
  magnet_uri: '',
  seq_dl: false,
  f_l_piece_prio: false,
  force_start: false,
  auto_tmm: false,
  availability: 1,
  tracker: '',
  dl_limit: 0,
  up_limit: 0,
  ratio: 0,
  eta: 8640000,
  dlspeed: 0,
  upspeed: 0,
  uploaded: 0,
  num_seeds: 0,
  num_leechs: 0,
  num_complete: -1,
  num_incomplete: -1,
}

const list = [
  { name: 'Blender 4.3 Splash Assets', state: 'downloading', progress: 0.62, size: 4.2 * G, completed: 2.6 * G, dlspeed: 12.1 * M, upspeed: 820 * K, eta: 480, uploaded: 318 * M, ratio: 0.12, num_seeds: 20, num_leechs: 34, num_complete: 30, num_incomplete: 11, up_limit: 10 * M },
  { name: 'Sintel.2010.2160p.HDR.mkv', state: 'downloading', progress: 0.34, size: 11.8 * G, completed: 4 * G, dlspeed: 9.6 * M, eta: 1260, num_seeds: 12, num_leechs: 19 },
  { name: 'archlinux-2026.11.01-x86_64.iso', state: 'uploading', progress: 1, size: 1.2 * G, completed: 1.2 * G, upspeed: 310 * K, uploaded: 5.76 * G, num_leechs: 12 },
  { name: 'ubuntu-24.04.3-desktop-amd64.iso', state: 'uploading', progress: 1, size: 6.1 * G, completed: 6.1 * G, upspeed: 1.4 * M, uploaded: 14.1 * G, num_leechs: 8 },
  { name: 'Tears.of.Steel.1080p.mkv', state: 'stoppedUP', progress: 1, size: 2.6 * G, completed: 2.6 * G },
  { name: 'Big.Buck.Bunny.4K.60fps.mp4', state: 'stoppedDL', progress: 0.78, size: 3.4 * G, completed: 2.65 * G },
  { name: 'debian-13.2.0-amd64-DVD-1.iso', state: 'queuedDL', progress: 0.03, size: 3.9 * G, completed: 0.1 * G },
]

const torrents = Object.fromEntries(
  list.map((x, i) => [hash(i), { ...base, ...x, hash: hash(i), total_size: x.size, added_on: 1_790_000_000 - i * 1000 }]),
)

const server_state = {
  connection_status: 'connected',
  dl_info_speed: 21.7 * M,
  up_info_speed: 3.1 * M,
  dl_info_data: 0,
  up_info_data: 0,
  dl_rate_limit: 5 * M,
  up_rate_limit: 5 * M,
  use_alt_speed_limits: false,
  free_space_on_disk: 1.84 * T,
  dht_nodes: 100,
  global_ratio: '1.00',
  queueing: true,
}

const file = (index: number, name: string, size: number, progress: number, priority: number) => ({
  index, name, size, progress, priority, piece_range: [0, 1], availability: 1,
})

const files = [
  file(0, 'blender-splash/splash_scene.blend', 2.9 * G, 0.58, 7),
  file(1, 'blender-splash/textures/hdri_4k.exr', 1.1 * G, 0.73, 1),
  file(2, 'blender-splash/textures/hdri_8k.exr', 3.4 * G, 0, 0),
  file(3, 'blender-splash/README.txt', 4 * K, 1, 1),
]

const tracker = (url: string, status: number, num_seeds: number, num_peers: number, num_downloaded: number, msg: string) => ({
  url, status, tier: 0, num_seeds, num_peers, num_leeches: 0, num_downloaded, msg,
})

const trackers = [
  tracker('** [DHT] **', 2, 36, 4, -1, ''),
  tracker('** [PeX] **', 2, 9, 2, -1, ''),
  tracker('** [LSD] **', 0, 0, 0, -1, ''),
  tracker('udp://tracker.opentrackr.org:1337/announce', 2, 312, 41, 18204, 'Следующий анонс через 24 мин'),
  tracker('udp://open.demonii.com:1337/announce', 3, -1, -1, -1, 'Отправка анонса…'),
  tracker('https://tracker.example.org/announce', 4, 0, 0, 0, 'Таймаут соединения'),
]

const peer = (ip: string, port: number, client: string, progress: number, dl_speed: number, up_speed: number, downloaded: number, flags: string, country: string, country_code: string) => ({
  ip, port, client, progress, dl_speed, up_speed, downloaded, uploaded: 0, flags, flags_desc: '', country, country_code, connection: 'BT', relevance: 1, files: '',
})

const peers = [
  peer('203.0.113.24', 51413, 'Transmission 4.0.6', 1, 4.2 * M, 0, 612 * M, 'D E H', 'Нидерланды', 'nl'),
  peer('198.51.100.7', 6881, 'qBittorrent 5.1.2', 1, 3.1 * M, 120 * K, 488 * M, 'D U E', 'Германия', 'de'),
  peer('192.0.2.155', 42000, 'Deluge 2.1.1', 1, 2.4 * M, 0, 391 * M, 'D H', 'Франция', 'fr'),
  peer('203.0.113.90', 6881, 'libtorrent 2.0.10', 0.81, 1.6 * M, 410 * K, 207 * M, 'D U X', 'Польша', 'pl'),
  peer('198.51.100.42', 50000, 'qBittorrent 4.6.7', 0.47, 640 * K, 290 * K, 96 * M, 'D U P', 'Италия', 'it'),
  peer('192.0.2.3', 34567, 'BiglyBT 3.7', 0.12, 0, 0, 0, 'd', 'Украина', 'ua'),
]

/** The same formula as the mockups' piece map. */
const pieces = Array.from({ length: 100 }, (_, k) => {
  const v = (k * 37 + (k % 7) * 11) % 100
  return v < 62 ? 2 : v < 70 ? 1 : 0
})

const properties = {
  save_path: '/downloads/', creation_date: 1_790_000_000, piece_size: 16 * M, comment: '', total_wasted: 0,
  total_uploaded: 318 * M, total_downloaded: 2.6 * G, up_limit: 0, dl_limit: 0, time_elapsed: 600, seeding_time: 0,
  nb_connections: 6, share_ratio: 0.12, addition_date: 1_790_000_000, completion_date: 0, created_by: '',
  pieces_have: 62, pieces_num: 100, hash: HASH, infohash_v1: HASH, infohash_v2: '', name: list[0].name, total_size: 4.2 * G,
}

const preferences = {
  save_path: '/downloads', temp_path_enabled: true, temp_path: '/downloads/.incomplete', add_stopped_enabled: false,
  auto_delete_mode: 1, max_ratio_enabled: true, max_ratio: 2, max_seeding_time_enabled: true, max_seeding_time: 1440,
  listen_port: 6881, upnp: true, max_connec: 500, max_connec_per_torrent: 100, max_uploads: 20, max_uploads_per_torrent: 4,
  dl_limit: 0, up_limit: 5 * M, alt_dl_limit: M, alt_up_limit: M, scheduler_enabled: false, schedule_from_hour: 8,
  schedule_from_min: 0, schedule_to_hour: 20, schedule_to_min: 0, scheduler_days: 0, dht: true, pex: true, lsd: true,
  encryption: 0, anonymous_mode: false, queueing_enabled: true, max_active_downloads: 3, max_active_uploads: 3,
  max_active_torrents: 5, web_ui_username: 'admin', bypass_local_auth: false, bypass_auth_subnet_whitelist_enabled: false,
  bypass_auth_subnet_whitelist: '', resolve_peer_countries: true, web_ui_port: 8080, locale: 'ru',
}

export interface MockOptions {
  /** Answer the session check with 403 and every login with "Fails.": the login screen with its error. */
  signedOut?: boolean
  /** Adds the mockups' category and tag: the add dialog shows them, the sidebar then has its groups. */
  taxonomy?: boolean
  /** Moving global speeds, so that the sparkline draws something: for the README screenshots. */
  liveSpeeds?: boolean
}

/** Replaces the whole of /api/v2/*; nothing reaches a server. */
export async function mockApi(page: Page, opts: MockOptions = {}) {
  let rid = 0
  const answer = (route: Route, path: string) => {
    const json = (body: unknown) => route.fulfill({ json: body })
    const text = (body: string, status = 200) => route.fulfill({ status, contentType: 'text/plain', body })
    if (opts.signedOut) {
      if (path === 'auth/login') return text('Fails.')
      return text('Forbidden', 403)
    }
    switch (path) {
      case 'app/version':
        return text('v5.1.2')
      case 'app/webapiVersion':
        return text('2.11.4')
      case 'app/preferences':
        return json(preferences)
      case 'sync/maindata':
        rid++
        return json(
          rid === 1
            ? {
                rid, full_update: true, torrents, server_state,
                categories: opts.taxonomy ? { Софт: { name: 'Софт', savePath: '/downloads/software' } } : {},
                tags: opts.taxonomy ? ['linux'] : [],
              }
            : opts.liveSpeeds
              ? { rid, server_state: { dl_info_speed: (19 + 5 * Math.sin(rid / 1.7) + 2 * Math.sin(rid * 1.3)) * M, up_info_speed: (3 + Math.sin(rid / 2)) * M } }
              : { rid },
        )
      case 'sync/torrentPeers':
        return json({ rid: 1, full_update: true, show_flags: true, peers: Object.fromEntries(peers.map((p) => [`${p.ip}:${p.port}`, p])) })
      case 'torrents/files':
        return json(files)
      case 'torrents/trackers':
        return json(trackers)
      case 'torrents/properties':
        return json(properties)
      case 'torrents/pieceStates':
        return json(pieces)
      default:
        return text('Ok.')
    }
  }
  await page.route('**/api/v2/**', (route) => {
    const path = new URL(route.request().url()).pathname.split('/api/v2/')[1]
    return answer(route, path)
  })
}

const encoder = new TextEncoder()
const bytes = (s: string) => encoder.encode(s)

function bencode(v: unknown): Uint8Array[] {
  if (typeof v === 'number') return [bytes(`i${v}e`)]
  if (typeof v === 'string') return bencode(bytes(v))
  if (v instanceof Uint8Array) return [bytes(`${v.length}:`), v]
  if (Array.isArray(v)) return [bytes('l'), ...v.flatMap(bencode), bytes('e')]
  const entries = Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1))
  return [bytes('d'), ...entries.flatMap(([k, x]) => [...bencode(k), ...bencode(x)]), bytes('e')]
}

/** AddTorrent mockup's sample: «ubuntu-24.04.3-desktop-amd64.iso.torrent», 6.10 ГБ, 4 файла. */
export function sampleTorrent() {
  const content = [
    ['ubuntu-24.04.3-desktop-amd64.iso', Math.round(6.1 * G)],
    ['SHA256SUMS', K],
    ['SHA256SUMS.gpg', 833],
    ['README.diskdefines', 231],
  ] as const
  const info = {
    name: 'ubuntu-24.04',
    'piece length': 16 * M,
    pieces: new Uint8Array(20),
    files: content.map(([name, length]) => ({ length, path: [name] })),
  }
  return {
    name: 'ubuntu-24.04.3-desktop-amd64.iso.torrent',
    mimeType: 'application/x-bittorrent',
    buffer: Buffer.concat(bencode({ info })),
  }
}
