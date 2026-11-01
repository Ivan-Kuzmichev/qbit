import type { Preferences, Torrent } from '../api/types'
import { parseTorrent } from '../features/add/parseTorrent'

/**
 * The qBittorrent WebAPI as far as the UI uses it, simulated in memory for the public demo.
 * Nothing leaves the page: there is no network and nothing downloads.
 */
const K = 1024
const M = K * K
const G = M * K
const T = G * K
const MAX_ACTIVE_DOWNLOADS = 3

const DOWNLOADING = new Set(['downloading', 'forcedDL', 'stalledDL', 'metaDL'])
const SEEDING = new Set(['uploading', 'forcedUP', 'stalledUP'])

interface DemoFile {
  index: number
  name: string
  size: number
  priority: number
  piece_range: [number, number]
  availability: number
}

interface DemoTorrent extends Torrent {
  baseDl: number
  baseUp: number
  files: DemoFile[]
  trackersList: DemoTracker[]
}

interface DemoTracker {
  url: string
  status: number
  tier: number
  num_seeds: number
  num_peers: number
  num_leeches: number
  num_downloaded: number
  msg: string
}

const tracker = (url: string, status: number, seeds: number, peers: number, done: number, msg: string): DemoTracker => ({
  url, status, tier: 0, num_seeds: seeds, num_peers: peers, num_leeches: 0, num_downloaded: done, msg,
})

const defaultTrackers = (): DemoTracker[] => [
  tracker('** [DHT] **', 2, 36, 4, -1, ''),
  tracker('** [PeX] **', 2, 9, 2, -1, ''),
  tracker('** [LSD] **', 0, 0, 0, -1, ''),
  tracker('udp://tracker.opentrackr.org:1337/announce', 2, 312, 41, 18204, 'Next announce in 24 min'),
  tracker('udp://open.demonii.com:1337/announce', 3, -1, -1, -1, 'Announcing…'),
  tracker('https://tracker.example.org/announce', 4, 0, 0, 0, 'Connection timed out'),
]

const peer = (ip: string, port: number, client: string, progress: number, dl: number, up: number, got: number, flags: string, country: string, code: string) => ({
  ip, port, client, progress, dl_speed: dl, up_speed: up, downloaded: got, uploaded: 0, flags, flags_desc: '', country, country_code: code, connection: 'BT', relevance: 1, files: '',
})

const PEERS = [
  peer('203.0.113.24', 51413, 'Transmission 4.0.6', 1, 4.2 * M, 0, 612 * M, 'D E H', 'Netherlands', 'nl'),
  peer('198.51.100.7', 6881, 'qBittorrent 5.1.2', 1, 3.1 * M, 120 * K, 488 * M, 'D U E', 'Germany', 'de'),
  peer('192.0.2.155', 42000, 'Deluge 2.1.1', 1, 2.4 * M, 0, 391 * M, 'D H', 'France', 'fr'),
  peer('203.0.113.90', 6881, 'libtorrent 2.0.10', 0.81, 1.6 * M, 410 * K, 207 * M, 'D U X', 'Poland', 'pl'),
  peer('198.51.100.42', 50000, 'qBittorrent 4.6.7', 0.47, 640 * K, 290 * K, 96 * M, 'D U P', 'Italy', 'it'),
  peer('192.0.2.3', 34567, 'BiglyBT 3.7', 0.12, 0, 0, 0, 'd', 'Japan', 'jp'),
]

const file = (index: number, name: string, size: number, priority = 1): DemoFile => ({
  index, name, size, priority, piece_range: [0, 1], availability: 1,
})

const initialPreferences = (): Preferences => ({
  save_path: '/downloads', temp_path_enabled: true, temp_path: '/downloads/.incomplete', add_stopped_enabled: false,
  auto_delete_mode: 1, max_ratio_enabled: true, max_ratio: 2, max_seeding_time_enabled: true, max_seeding_time: 1440,
  listen_port: 6881, upnp: true, max_connec: 500, max_connec_per_torrent: 100, max_uploads: 20, max_uploads_per_torrent: 4,
  dl_limit: 0, up_limit: 5 * M, alt_dl_limit: M, alt_up_limit: M, scheduler_enabled: false, schedule_from_hour: 8,
  schedule_from_min: 0, schedule_to_hour: 20, schedule_to_min: 0, scheduler_days: 0, dht: true, pex: true, lsd: true,
  encryption: 0, anonymous_mode: false, queueing_enabled: true, max_active_downloads: MAX_ACTIVE_DOWNLOADS, max_active_uploads: 3,
  max_active_torrents: 5, web_ui_username: 'demo', bypass_local_auth: false, bypass_auth_subnet_whitelist_enabled: false,
  bypass_auth_subnet_whitelist: '', resolve_peer_countries: true, alternative_webui_enabled: true,
  alternative_webui_path: '/qbit', autorun_enabled: false, autorun_program: '', web_ui_port: 8080, locale: 'en',
})

export interface DemoRequest {
  get(name: string): string | null
  file?(name: string): File[]
}

export interface DemoResponse {
  status: number
  json?: unknown
  text?: string
}

const ok = (): DemoResponse => ({ status: 200, text: 'Ok.' })
const json = (body: unknown): DemoResponse => ({ status: 200, json: body })
const hex = (s: string) => Array.from({ length: 40 }, (_, i) => s[i % s.length]).join('')

export function createDemoServer(now: () => number = Date.now) {
  const started = now()
  const seconds = () => Math.floor(now() / 1000)
  let last = started
  let rid = 0
  let signedIn = true
  let altMode = false
  let serial = 0
  const preferences = initialPreferences()
  const categories: Record<string, { name: string; savePath: string }> = {
    Linux: { name: 'Linux', savePath: '/downloads/linux' },
    Movies: { name: 'Movies', savePath: '/downloads/movies' },
    Software: { name: 'Software', savePath: '/downloads/software' },
  }
  const tags = new Set(['open-source', 'blender'])
  const torrents = new Map<string, DemoTorrent>()

  function add(p: Partial<DemoTorrent> & { hash: string; name: string; size: number }) {
    const order = torrents.size
    const t: DemoTorrent = {
      state: 'downloading', progress: 0, total_size: p.size, completed: 0, downloaded: 0, uploaded: 0, dlspeed: 0, upspeed: 0,
      eta: 8640000, ratio: 0, priority: order + 1, num_seeds: 0, num_leechs: 0, num_complete: 30, num_incomplete: 11,
      added_on: seconds() - order * 900, completion_on: -1, category: '', tags: '', save_path: '/downloads/',
      magnet_uri: `magnet:?xt=urn:btih:${p.hash}&dn=${encodeURIComponent(p.name)}`, seq_dl: false, f_l_piece_prio: false,
      force_start: false, auto_tmm: false, dl_limit: 0, up_limit: 0, availability: 1, tracker: 'udp://tracker.opentrackr.org:1337/announce',
      baseDl: 0, baseUp: 0, files: [file(0, p.name, p.size)], trackersList: defaultTrackers(),
      ...p,
    }
    t.completed = t.completed || t.progress * t.size
    t.downloaded = t.completed
    torrents.set(t.hash, t)
    return t
  }

  add({
    hash: hex('a1'), name: 'Blender 4.3 Splash Assets', progress: 0.62, size: 4.2 * G, baseDl: 12.1 * M, baseUp: 820 * K, uploaded: 318 * M,
    num_seeds: 20, num_leechs: 34, category: 'Software', tags: 'blender, open-source',
    files: [
      file(0, 'blender-splash/splash_scene.blend', 2.9 * G, 7),
      file(1, 'blender-splash/textures/hdri_4k.exr', 1.1 * G),
      file(2, 'blender-splash/textures/hdri_8k.exr', 0.2 * G, 0),
      file(3, 'blender-splash/README.txt', 4 * K),
    ],
  })
  add({ hash: hex('b2'), name: 'Sintel.2010.2160p.HDR.mkv', progress: 0.34, size: 11.8 * G, baseDl: 9.6 * M, baseUp: 240 * K, num_seeds: 12, num_leechs: 19, category: 'Movies', tags: 'open-source' })
  add({ hash: hex('c3'), name: 'archlinux-2026.11.01-x86_64.iso', state: 'uploading', progress: 1, size: 1.2 * G, baseUp: 310 * K, uploaded: 5.76 * G, num_leechs: 12, category: 'Linux', tags: 'open-source', completion_on: seconds() - 7200 })
  add({ hash: hex('d4'), name: 'ubuntu-24.04.3-desktop-amd64.iso', state: 'uploading', progress: 1, size: 6.1 * G, baseUp: 1.4 * M, uploaded: 14.1 * G, num_leechs: 8, category: 'Linux', tags: 'open-source', completion_on: seconds() - 86400 })
  add({ hash: hex('e5'), name: 'Tears.of.Steel.1080p.mkv', state: 'stoppedUP', progress: 1, size: 2.6 * G, baseUp: 500 * K, category: 'Movies', completion_on: seconds() - 172800 })
  add({ hash: hex('f6'), name: 'Big.Buck.Bunny.4K.60fps.mp4', state: 'stoppedDL', progress: 0.78, size: 3.4 * G, baseDl: 7.4 * M, baseUp: 200 * K, num_seeds: 9, num_leechs: 6, category: 'Movies' })
  add({ hash: hex('07'), name: 'debian-13.2.0-amd64-DVD-1.iso', state: 'queuedDL', progress: 0.03, size: 3.9 * G, baseDl: 6.2 * M, baseUp: 90 * K, num_seeds: 16, num_leechs: 5, category: 'Linux', tags: 'open-source' })

  /** Advances every torrent by the real time passed since the last look. */
  function tick() {
    const t1 = now()
    const dt = Math.max(0, (t1 - last) / 1000)
    last = t1
    const wave = (i: number, phase: number) => 1 + 0.16 * Math.sin(t1 / 1700 + i * 1.3 + phase) + 0.06 * Math.sin(t1 / 610 + i)

    const all = [...torrents.values()]
    all.forEach((t, i) => {
      t.dlspeed = DOWNLOADING.has(t.state) ? Math.round(t.baseDl * wave(i, 0)) : 0
      t.upspeed = DOWNLOADING.has(t.state) || SEEDING.has(t.state) ? Math.round(t.baseUp * wave(i, 2)) : 0
      if (t.dl_limit > 0) t.dlspeed = Math.min(t.dlspeed, t.dl_limit)
      if (t.up_limit > 0) t.upspeed = Math.min(t.upspeed, t.up_limit)
    })

    // A global limit shares itself out over the active torrents.
    const dlCap = altMode ? preferences.alt_dl_limit : preferences.dl_limit
    const upCap = altMode ? preferences.alt_up_limit : preferences.up_limit
    const dlSum = all.reduce((s, t) => s + t.dlspeed, 0)
    const upSum = all.reduce((s, t) => s + t.upspeed, 0)
    const dlScale = dlCap > 0 && dlSum > dlCap ? dlCap / dlSum : 1
    const upScale = upCap > 0 && upSum > upCap ? upCap / upSum : 1

    for (const t of all) {
      t.dlspeed = Math.round(t.dlspeed * dlScale)
      t.upspeed = Math.round(t.upspeed * upScale)
      t.uploaded += t.upspeed * dt
      if (t.dlspeed > 0) {
        t.completed = Math.min(t.size, t.completed + t.dlspeed * dt)
        t.downloaded = t.completed
        t.progress = t.size > 0 ? t.completed / t.size : 0
      }
      t.ratio = t.downloaded > 0 ? t.uploaded / t.downloaded : 0
      t.eta = t.dlspeed > 0 ? Math.round((t.size - t.completed) / t.dlspeed) : 8640000
      if (DOWNLOADING.has(t.state) && t.progress >= 1) {
        t.state = t.force_start ? 'forcedUP' : 'uploading'
        t.completion_on = seconds()
        t.dlspeed = 0
        t.eta = 8640000
      }
    }

    // A freed slot goes to whatever waits in the queue.
    let active = all.filter((t) => DOWNLOADING.has(t.state) && !t.force_start).length
    for (const t of all) {
      if (active >= MAX_ACTIVE_DOWNLOADS) break
      if (t.state === 'queuedDL') {
        t.state = 'downloading'
        active++
      }
    }
  }

  const select = (req: DemoRequest, name = 'hashes') => {
    const v = req.get(name) ?? ''
    if (v === 'all') return [...torrents.values()]
    return v.split('|').map((h) => torrents.get(h.toLowerCase())).filter((t): t is DemoTorrent => Boolean(t))
  }
  const one = (req: DemoRequest) => torrents.get((req.get('hash') ?? '').toLowerCase())

  const start = (t: DemoTorrent) => {
    t.force_start = false
    if (t.state === 'stoppedDL' || t.state === 'queuedDL') t.state = 'downloading'
    else if (t.state === 'stoppedUP') t.state = 'uploading'
    if (!t.baseDl) t.baseDl = 5 * M
    if (!t.baseUp) t.baseUp = 300 * K
  }
  const stop = (t: DemoTorrent) => {
    t.force_start = false
    t.state = t.progress >= 1 ? 'stoppedUP' : 'stoppedDL'
  }

  function publicTorrent(t: DemoTorrent): Torrent {
    const rest: Partial<DemoTorrent> & Torrent = { ...t }
    delete rest.baseDl
    delete rest.baseUp
    delete rest.files
    delete rest.trackersList
    const active = DOWNLOADING.has(t.state) || SEEDING.has(t.state)
    return { ...rest, num_seeds: active ? t.num_seeds : 0, num_leechs: active ? t.num_leechs : 0 }
  }

  function addOne(name: string, size: number, hash: string, stopped: boolean, req: DemoRequest, files?: DemoFile[]) {
    if (torrents.has(hash)) return false
    const category = req.get('category') ?? ''
    const t = add({
      hash, name, size, category, tags: req.get('tags') ?? '', save_path: req.get('savepath') || preferences.save_path,
      state: stopped ? 'stoppedDL' : 'downloading', baseDl: (4 + serial * 1.5) * M, baseUp: 160 * K, num_seeds: 14, num_leechs: 7,
      added_on: seconds(), seq_dl: req.get('sequentialDownload') === 'true', f_l_piece_prio: req.get('firstLastPiecePrio') === 'true',
      priority: torrents.size + 1, ...(files ? { files } : {}),
    })
    if (req.get('skip_checking') === 'true') {
      t.progress = 1
      t.completed = t.size
      t.state = stopped ? 'stoppedUP' : 'uploading'
    }
    return true
  }

  async function handleAdd(req: DemoRequest): Promise<DemoResponse> {
    const stopped = req.get('stopped') === 'true'
    let added = 0
    for (const line of (req.get('urls') ?? '').split('\n').map((s) => s.trim()).filter(Boolean)) {
      serial++
      const btih = /xt=urn:btih:([a-z0-9]+)/i.exec(line)?.[1]?.toLowerCase()
      const dn = /[?&]dn=([^&]+)/.exec(line)?.[1]
      const hash = btih && btih.length === 40 ? btih : hex(`0${serial}e${(now() % 100000).toString(16)}`)
      const name = dn ? decodeURIComponent(dn.replace(/\+/g, ' ')) : hash
      if (addOne(name, 2.4 * G, hash, stopped, req)) added++
    }
    for (const f of req.file?.('torrents') ?? []) {
      serial++
      const parsed = parseTorrent(new Uint8Array(await f.arrayBuffer()))
      const files = parsed.files.filter((x) => !x.pad).map((x, i) => file(i, x.path, x.size))
      if (addOne(parsed.name, parsed.size, parsed.ids[0], stopped, req, files)) added++
    }
    return added > 0 ? ok() : { status: 200, text: 'Fails.' }
  }

  async function handle(path: string, req: DemoRequest): Promise<DemoResponse> {
    if (path === 'auth/login') {
      signedIn = true
      return ok()
    }
    if (!signedIn) return { status: 403, text: 'Forbidden' }

    switch (path) {
      case 'auth/logout':
        signedIn = false
        return ok()
      case 'app/version':
        return { status: 200, text: 'v5.1.2' }
      case 'app/webapiVersion':
        return { status: 200, text: '2.11.4' }
      case 'app/preferences':
        return json(preferences)
      case 'app/setPreferences': {
        const changes = JSON.parse(req.get('json') ?? '{}') as Partial<Preferences>
        delete changes.web_ui_password
        Object.assign(preferences, changes)
        return ok()
      }
      case 'sync/maindata': {
        tick()
        rid++
        const dl = [...torrents.values()].reduce((s, t) => s + t.dlspeed, 0)
        const up = [...torrents.values()].reduce((s, t) => s + t.upspeed, 0)
        return json({
          rid,
          // Everything every time: simple, and with a handful of torrents it costs nothing.
          full_update: true,
          torrents: Object.fromEntries([...torrents.values()].map((t) => [t.hash, publicTorrent(t)])),
          categories,
          tags: [...tags],
          server_state: {
            connection_status: 'connected', dl_info_speed: dl, up_info_speed: up, dl_info_data: 0, up_info_data: 0,
            dl_rate_limit: altMode ? preferences.alt_dl_limit : preferences.dl_limit,
            up_rate_limit: altMode ? preferences.alt_up_limit : preferences.up_limit,
            use_alt_speed_limits: altMode, free_space_on_disk: 1.84 * T, dht_nodes: 212, global_ratio: '1.24', queueing: true,
          },
        })
      }
      case 'sync/torrentPeers': {
        const t = one(req)
        const active = t && (DOWNLOADING.has(t.state) || SEEDING.has(t.state))
        return json({
          rid: 1, full_update: true, show_flags: true,
          peers: active ? Object.fromEntries(PEERS.map((p) => [`${p.ip}:${p.port}`, p])) : {},
        })
      }
      case 'torrents/info': {
        const list = req.get('hashes') ? select(req) : [...torrents.values()]
        return json(list.map(publicTorrent))
      }
      case 'torrents/files': {
        const t = one(req)
        if (!t) return { status: 404, text: 'Not Found' }
        return json(t.files.map((f) => ({ ...f, progress: f.priority === 0 ? 0 : t.progress })))
      }
      case 'torrents/trackers': {
        const t = one(req)
        return t ? json(t.trackersList) : { status: 404, text: 'Not Found' }
      }
      case 'torrents/pieceStates': {
        const t = one(req)
        if (!t) return { status: 404, text: 'Not Found' }
        const have = t.progress * 100
        const working = DOWNLOADING.has(t.state) ? 8 : 0
        return json(Array.from({ length: 100 }, (_, k) => {
          const v = (k * 37 + (k % 7) * 11) % 100
          return v < have ? 2 : v < have + working ? 1 : 0
        }))
      }
      case 'torrents/properties': {
        const t = one(req)
        if (!t) return { status: 404, text: 'Not Found' }
        return json({
          save_path: t.save_path, creation_date: t.added_on - 86400, piece_size: 16 * M, comment: '', total_wasted: 0,
          total_uploaded: t.uploaded, total_downloaded: t.downloaded, up_limit: t.up_limit, dl_limit: t.dl_limit,
          time_elapsed: Math.max(0, seconds() - t.added_on), seeding_time: t.progress >= 1 ? 3600 : 0, nb_connections: 6,
          share_ratio: t.ratio, addition_date: t.added_on, completion_date: t.completion_on, created_by: '',
          pieces_have: Math.floor(t.progress * 256), pieces_num: 256, hash: t.hash, infohash_v1: t.hash, infohash_v2: '', name: t.name, total_size: t.size,
        })
      }
      case 'torrents/start':
        select(req).forEach(start)
        return ok()
      case 'torrents/stop':
        select(req).forEach(stop)
        return ok()
      case 'torrents/setForceStart':
        for (const t of select(req)) {
          start(t)
          t.force_start = req.get('value') === 'true'
          t.state = t.progress >= 1 ? (t.force_start ? 'forcedUP' : 'uploading') : t.force_start ? 'forcedDL' : 'downloading'
        }
        return ok()
      case 'torrents/delete':
        select(req).forEach((t) => torrents.delete(t.hash))
        return ok()
      case 'torrents/add':
        return handleAdd(req)
      case 'torrents/filePrio': {
        const t = one(req)
        const ids = (req.get('id') ?? '').split('|').map(Number)
        const priority = Number(req.get('priority'))
        for (const f of t?.files ?? []) if (ids.includes(f.index)) f.priority = priority
        return ok()
      }
      case 'torrents/setLocation':
        for (const t of select(req)) t.save_path = req.get('location') ?? t.save_path
        return ok()
      case 'torrents/setCategory':
        for (const t of select(req)) t.category = req.get('category') ?? ''
        return ok()
      case 'torrents/createCategory': {
        const name = req.get('category') ?? ''
        if (name) categories[name] = { name, savePath: req.get('savePath') ?? '' }
        return ok()
      }
      case 'torrents/addTags': {
        const added = (req.get('tags') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
        added.forEach((x) => tags.add(x))
        for (const t of select(req)) t.tags = [...new Set([...t.tags.split(', ').filter(Boolean), ...added])].join(', ')
        return ok()
      }
      case 'torrents/removeTags': {
        const gone = (req.get('tags') ?? '').split(',').map((s) => s.trim())
        for (const t of select(req)) t.tags = t.tags.split(', ').filter((x) => x && !gone.includes(x)).join(', ')
        return ok()
      }
      case 'torrents/toggleSequentialDownload':
        for (const t of select(req)) t.seq_dl = !t.seq_dl
        return ok()
      case 'torrents/toggleFirstLastPiecePrio':
        for (const t of select(req)) t.f_l_piece_prio = !t.f_l_piece_prio
        return ok()
      case 'torrents/setDownloadLimit':
        for (const t of select(req)) t.dl_limit = Number(req.get('limit'))
        return ok()
      case 'torrents/setUploadLimit':
        for (const t of select(req)) t.up_limit = Number(req.get('limit'))
        return ok()
      case 'torrents/addTrackers': {
        const t = one(req)
        for (const url of (req.get('urls') ?? '').split('\n').map((s) => s.trim()).filter(Boolean)) {
          t?.trackersList.push(tracker(url, 1, -1, -1, -1, ''))
        }
        return ok()
      }
      case 'torrents/removeTrackers': {
        const t = one(req)
        const gone = (req.get('urls') ?? '').split('|')
        if (t) t.trackersList = t.trackersList.filter((x) => !gone.includes(x.url))
        return ok()
      }
      case 'transfer/setDownloadLimit':
        preferences.dl_limit = Number(req.get('limit'))
        return ok()
      case 'transfer/setUploadLimit':
        preferences.up_limit = Number(req.get('limit'))
        return ok()
      case 'transfer/toggleSpeedLimitsMode':
        altMode = !altMode
        return ok()
      default:
        // recheck, reannounce, queue order: accepted, nothing to show for them here
        return ok()
    }
  }

  return { handle }
}
