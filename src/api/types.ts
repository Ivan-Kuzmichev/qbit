export type TorrentState =
  | 'error' | 'missingFiles' | 'uploading' | 'stoppedUP' | 'queuedUP' | 'stalledUP'
  | 'checkingUP' | 'forcedUP' | 'allocating' | 'downloading' | 'metaDL' | 'forcedMetaDL'
  | 'stoppedDL' | 'queuedDL' | 'stalledDL' | 'checkingDL' | 'forcedDL'
  | 'checkingResumeData' | 'moving' | 'unknown'

export interface Torrent {
  hash: string
  name: string
  state: TorrentState | string
  progress: number
  size: number
  total_size: number
  completed: number
  downloaded: number
  uploaded: number
  dlspeed: number
  upspeed: number
  eta: number
  ratio: number
  priority: number
  num_seeds: number
  num_leechs: number
  num_complete: number
  num_incomplete: number
  added_on: number
  completion_on: number
  category: string
  tags: string
  save_path: string
  magnet_uri: string
  seq_dl: boolean
  f_l_piece_prio: boolean
  force_start: boolean
  auto_tmm: boolean
  dl_limit: number
  up_limit: number
  availability: number
  tracker: string
}

export interface ServerState {
  connection_status: 'connected' | 'firewalled' | 'disconnected'
  dl_info_speed: number
  dl_info_data: number
  up_info_speed: number
  up_info_data: number
  dl_rate_limit: number
  up_rate_limit: number
  use_alt_speed_limits: boolean
  free_space_on_disk: number
  dht_nodes: number
  global_ratio: string
  queueing: boolean
}

export interface CategoryInfo {
  name: string
  savePath: string
}

export interface MainData {
  rid: number
  full_update?: boolean
  torrents?: Record<string, Partial<Torrent>>
  torrents_removed?: string[]
  categories?: Record<string, CategoryInfo>
  categories_removed?: string[]
  tags?: string[]
  tags_removed?: string[]
  server_state?: Partial<ServerState>
}

export interface TorrentFile {
  index: number
  name: string
  size: number
  progress: number
  priority: number
  is_seed?: boolean
  piece_range: [number, number]
  availability: number
}

export interface Tracker {
  url: string
  /** 0 disabled, 1 not contacted, 2 working, 3 updating, 4 not working */
  status: number
  tier: number
  num_peers: number
  num_seeds: number
  num_leeches: number
  num_downloaded: number
  msg: string
}

export interface Peer {
  ip: string
  port: number
  client: string
  country: string
  country_code: string
  connection: string
  flags: string
  flags_desc: string
  progress: number
  dl_speed: number
  up_speed: number
  downloaded: number
  uploaded: number
  relevance: number
  files: string
}

export interface Properties {
  save_path: string
  creation_date: number
  piece_size: number
  comment: string
  total_wasted: number
  total_uploaded: number
  total_downloaded: number
  up_limit: number
  dl_limit: number
  time_elapsed: number
  seeding_time: number
  nb_connections: number
  share_ratio: number
  addition_date: number
  completion_date: number
  created_by: string
  pieces_have: number
  pieces_num: number
  hash: string
  infohash_v1: string
  infohash_v2: string
  name: string
  total_size: number
}

/** Only fields the UI uses. */
export interface Preferences {
  save_path: string
  temp_path_enabled: boolean
  temp_path: string
  add_stopped_enabled: boolean
  /** 0 never, 1 delete the .torrent once added */
  auto_delete_mode: number
  max_ratio_enabled: boolean
  max_ratio: number
  max_seeding_time_enabled: boolean
  /** minutes */
  max_seeding_time: number
  listen_port: number
  upnp: boolean
  max_connec: number
  max_connec_per_torrent: number
  max_uploads: number
  max_uploads_per_torrent: number
  /** bytes/s, 0 = no limit */
  dl_limit: number
  up_limit: number
  alt_dl_limit: number
  alt_up_limit: number
  scheduler_enabled: boolean
  schedule_from_hour: number
  schedule_from_min: number
  schedule_to_hour: number
  schedule_to_min: number
  scheduler_days: number
  dht: boolean
  pex: boolean
  lsd: boolean
  encryption: number
  anonymous_mode: boolean
  queueing_enabled: boolean
  max_active_downloads: number
  max_active_uploads: number
  max_active_torrents: number
  web_ui_username: string
  /** Never returned by GET; accepted by setPreferences. */
  web_ui_password?: string
  bypass_local_auth: boolean
  bypass_auth_subnet_whitelist_enabled: boolean
  bypass_auth_subnet_whitelist: string
  resolve_peer_countries: boolean
  alternative_webui_enabled: boolean
  alternative_webui_path: string
  autorun_enabled: boolean
  autorun_program: string
  web_ui_port: number
  locale: string
}
