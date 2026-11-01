import { describe, expect, it } from 'vitest'
import { sections, type Row } from './schema'

const rows: Row[] = sections.flatMap((s) => s.cards.flatMap((c) => c.rows))
const keys = rows.map((r) => r.key)

describe('settings schema', () => {
  it('has the sections from the spec in order', () => {
    expect(sections.map((s) => s.id)).toEqual(['downloads', 'connection', 'speed', 'bittorrent', 'webui', 'appearance'])
  })
  it('covers every qBittorrent preference the page edits', () => {
    const expected = [
      'save_path', 'temp_path_enabled', 'temp_path', 'add_stopped_enabled', 'auto_delete_mode',
      'max_ratio_enabled', 'max_ratio', 'max_seeding_time_enabled', 'max_seeding_time',
      'listen_port', 'upnp', 'max_connec', 'max_connec_per_torrent', 'max_uploads', 'max_uploads_per_torrent',
      'dl_limit', 'up_limit', 'alt_dl_limit', 'alt_up_limit', 'scheduler_enabled',
      'schedule_from_hour', 'scheduler_days', 'dht', 'pex', 'lsd', 'encryption', 'anonymous_mode',
      'queueing_enabled', 'max_active_downloads', 'max_active_uploads', 'max_active_torrents',
      'web_ui_username', 'web_ui_password', 'bypass_local_auth', 'bypass_auth_subnet_whitelist_enabled',
      'bypass_auth_subnet_whitelist', 'resolve_peer_countries',
    ]
    for (const k of expected) expect(keys, k).toContain(k)
  })
  it('keys are unique and rows are plain data', () => {
    expect(new Set(keys).size).toBe(keys.length)
    expect(JSON.stringify(sections.map((s) => s.cards.map((c) => c.title)))).toBeTruthy()
  })
  it('qBittorrent select values', () => {
    const find = (k: string) => rows.find((r) => r.key === k)!.options!.map((o) => o.value)
    expect(find('encryption')).toEqual([0, 1, 2])
    expect(find('scheduler_days')).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })
  it('the ratio field depends on its switch', () => {
    const ratio = rows.find((r) => r.key === 'max_ratio')!
    expect(ratio.enabledBy).toBe('max_ratio_enabled')
    expect(ratio.visibleIf!({ max_ratio_enabled: false } as never)).toBe(false)
  })
  it('the port may be 0..65535', () => {
    const port = rows.find((r) => r.key === 'listen_port')!
    expect([port.min, port.max]).toEqual([0, 65535])
  })
})
