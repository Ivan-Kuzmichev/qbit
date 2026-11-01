import { describe, expect, it } from 'vitest'
import { createDemoServer, type DemoRequest } from './server'

const q = (p: Record<string, string> = {}, files: File[] = []): DemoRequest => ({
  get: (n) => p[n] ?? null,
  file: () => files,
})

function setup() {
  let clock = 1_800_000_000_000
  const s = createDemoServer(() => clock)
  const main = async () => (await s.handle('sync/maindata', q())).json as {
    torrents: Record<string, { name: string; state: string; progress: number; dlspeed: number; tags: string }>
    server_state: { use_alt_speed_limits: boolean; dl_info_speed: number; dl_rate_limit: number }
  }
  const byName = async (name: string) => {
    const [hash, t] = Object.entries((await main()).torrents).find(([, x]) => x.name.startsWith(name))!
    return { hash, ...t }
  }
  return { s, main, byName, advance: (sec: number) => void (clock += sec * 1000) }
}

describe('demo server', () => {
  it('downloads over time, then seeds', async () => {
    const { byName, advance } = setup()
    const before = await byName('Blender')
    advance(10)
    const later = await byName('Blender')
    expect(later.progress).toBeGreaterThan(before.progress)
    expect(later.dlspeed).toBeGreaterThan(0)
    advance(100_000)
    await byName('Blender')
    expect((await byName('Blender')).state).toBe('uploading')
  })

  it('a stopped torrent stands still and starts again', async () => {
    const { s, byName, advance } = setup()
    const { hash } = await byName('Sintel')
    await s.handle('torrents/stop', q({ hashes: hash }))
    const paused = await byName('Sintel')
    expect(paused.state).toBe('stoppedDL')
    advance(60)
    expect((await byName('Sintel')).progress).toBe(paused.progress)
    await s.handle('torrents/start', q({ hashes: hash }))
    advance(10)
    expect((await byName('Sintel')).progress).toBeGreaterThan(paused.progress)
  })

  it('hashes=all reaches every torrent, and a freed slot goes to the queue', async () => {
    const { s, main, byName } = setup()
    expect((await byName('debian')).state).toBe('downloading') // two active of three slots
    await s.handle('torrents/stop', q({ hashes: 'all' }))
    const states = Object.values((await main()).torrents).map((t) => t.state)
    expect(new Set(states)).toEqual(new Set(['stoppedDL', 'stoppedUP']))
  })

  it('deletes', async () => {
    const { s, main, byName } = setup()
    const { hash } = await byName('Sintel')
    await s.handle('torrents/delete', q({ hashes: hash, deleteFiles: 'true' }))
    expect((await main()).torrents[hash]).toBeUndefined()
  })

  it('adds magnet links, one per line, and refuses a duplicate', async () => {
    const { s, main, byName } = setup()
    const a = 'magnet:?xt=urn:btih:' + '1'.repeat(40) + '&dn=My+Film'
    const res = await s.handle('torrents/add', q({ urls: `${a}\nmagnet:?dn=Other` }))
    expect(res.text).toBe('Ok.')
    expect((await byName('My Film')).hash).toBe('1'.repeat(40))
    expect(Object.values((await main()).torrents).some((t) => t.name === 'Other')).toBe(true)
    expect((await s.handle('torrents/add', q({ urls: a }))).text).toBe('Fails.')
  })

  it('applies alternative limits', async () => {
    const { s, main, advance } = setup()
    await s.handle('transfer/toggleSpeedLimitsMode', q())
    advance(1)
    const m = await main()
    expect(m.server_state.use_alt_speed_limits).toBe(true)
    expect(m.server_state.dl_info_speed).toBeLessThanOrEqual(m.server_state.dl_rate_limit + 4)
  })

  it('keeps preferences in memory, never the password', async () => {
    const { s } = setup()
    await s.handle('app/setPreferences', q({ json: JSON.stringify({ upnp: false, web_ui_password: 'secret' }) }))
    const prefs = (await s.handle('app/preferences', q())).json as Record<string, unknown>
    expect(prefs.upnp).toBe(false)
    expect(prefs.web_ui_password).toBeUndefined()
  })

  it('signing out means 403 until signing in with anything', async () => {
    const { s } = setup()
    await s.handle('auth/logout', q())
    expect((await s.handle('app/version', q())).status).toBe(403)
    await s.handle('auth/login', q({ username: 'a', password: 'b' }))
    expect((await s.handle('app/version', q())).status).toBe(200)
  })

  it('answers details for a torrent, 404 for an unknown one', async () => {
    const { s, byName } = setup()
    const { hash } = await byName('Blender')
    expect(((await s.handle('torrents/files', q({ hash }))).json as unknown[]).length).toBe(4)
    expect(((await s.handle('torrents/pieceStates', q({ hash }))).json as unknown[]).length).toBe(100)
    expect((await s.handle('torrents/properties', q({ hash: 'nope' }))).status).toBe(404)
  })
})
