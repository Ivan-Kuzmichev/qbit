import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { addTorrents, reportAddResult, type AddDeps, type AddOptions, type AddRequest, type AddTorrentInput } from './addFlow'

const opts: AddOptions = { savepath: '/dl', category: 'Софт', tags: ['a', 'b'], start: true, sequential: false, firstLast: true, skipChecking: false }
const HASH = 'ABCDEF0123456789ABCDEF0123456789ABCDEF01'

const file = (name: string, selected: boolean[] | null = null, infohash = HASH): AddTorrentInput => ({
  name,
  data: new Blob(['x']),
  infohash,
  selected,
})

interface Call {
  path: string
  form: Record<string, string>
}

function setup(over: { add?: (n: number, form: FormData) => unknown; info?: (n: number) => unknown } = {}) {
  const calls: Call[] = []
  let clock = 0
  let adds = 0
  let polls = 0
  const api = {
    post: vi.fn(async (path: string, form: unknown) => {
      if (form instanceof FormData) {
        calls.push({ path, form: Object.fromEntries([...form.entries()].map(([k, v]) => [k, v instanceof Blob ? `[blob ${(v as File).name}]` : v])) })
        const r = over.add ? over.add(adds++, form) : 'Ok.'
        if (r instanceof Error) throw r
        return r
      }
      calls.push({ path, form: Object.fromEntries(Object.entries(form as Record<string, unknown>).map(([k, v]) => [k, String(v)])) })
      return ''
    }),
    get: vi.fn(async (path: string) => {
      calls.push({ path, form: {} })
      return over.info ? over.info(polls++) : [{ hash: HASH.toLowerCase() }]
    }),
  }
  const deps = {
    api: api as unknown as AddDeps['api'],
    sleep: vi.fn(async (ms: number) => {
      clock += ms
    }),
    now: () => clock,
  }
  return { deps, calls, api }
}
const req = (r: Partial<AddRequest>): AddRequest => ({ torrents: [], magnets: [], options: opts, ...r })

afterEach(() => vi.useRealTimers())

describe('addTorrents', () => {
  it('all files selected: one torrents/add, start follows the option, both flags sent', async () => {
    const { deps, calls } = setup()
    const res = await addTorrents(req({ torrents: [file('a.torrent', [true, true])] }), deps)
    expect(res).toEqual({ added: 1, failed: [] })
    expect(calls).toHaveLength(1)
    expect(calls[0].path).toBe('torrents/add')
    expect(calls[0].form).toMatchObject({
      torrents: '[blob a.torrent]',
      stopped: 'false',
      paused: 'false',
      savepath: '/dl',
      category: 'Софт',
      tags: 'a,b',
      sequentialDownload: 'false',
      firstLastPiecePrio: 'true',
      skip_checking: 'false',
    })
  })

  it('start off sends stopped and paused true', async () => {
    const { deps, calls } = setup()
    await addTorrents(req({ torrents: [file('a.torrent')], options: { ...opts, start: false } }), deps)
    expect(calls[0].form).toMatchObject({ stopped: 'true', paused: 'true' })
  })

  it('omits empty savepath, category and tags', async () => {
    const { deps, calls } = setup()
    await addTorrents(req({ torrents: [file('a.torrent')], options: { ...opts, savepath: '', category: '', tags: [] } }), deps)
    expect(calls[0].form).not.toHaveProperty('savepath')
    expect(calls[0].form).not.toHaveProperty('category')
    expect(calls[0].form).not.toHaveProperty('tags')
  })

  it('some files unchecked: adds stopped, waits for the infohash, sets priority 0, then starts', async () => {
    const { deps, calls } = setup({ info: (n) => (n < 2 ? [] : [{ hash: HASH.toLowerCase() }]) })
    const res = await addTorrents(req({ torrents: [file('a.torrent', [true, false, true, false])] }), deps)
    expect(res).toEqual({ added: 1, failed: [] })
    expect(calls.map((c) => c.path)).toEqual(['torrents/add', 'torrents/info', 'torrents/info', 'torrents/info', 'torrents/filePrio', 'torrents/start'])
    expect(calls[0].form).toMatchObject({ stopped: 'true', paused: 'true' })
    const prio = calls.find((c) => c.path === 'torrents/filePrio')!
    expect(prio.form).toEqual({ hash: HASH.toLowerCase(), id: '1|3', priority: '0' })
    expect(calls.at(-1)!.form).toEqual({ hashes: HASH.toLowerCase() })
  })

  it('matches the infohash case-insensitively', async () => {
    const { deps, calls } = setup({ info: () => [{ hash: HASH.toLowerCase() }] })
    await addTorrents(req({ torrents: [file('a.torrent', [false, true], HASH.toUpperCase())] }), deps)
    expect(calls.some((c) => c.path === 'torrents/filePrio')).toBe(true)
  })

  it('does not start when "start now" is off', async () => {
    const { deps, calls } = setup()
    await addTorrents(req({ torrents: [file('a.torrent', [true, false])], options: { ...opts, start: false } }), deps)
    expect(calls.map((c) => c.path)).not.toContain('torrents/start')
    expect(calls.map((c) => c.path)).toContain('torrents/filePrio')
  })

  it('gives up after 30 s and names the torrent', async () => {
    const { deps, calls } = setup({ info: () => [] })
    const res = await addTorrents(req({ torrents: [file('slow.torrent', [true, false])] }), deps)
    expect(res.added).toBe(0)
    expect(res.failed).toEqual([{ name: 'slow.torrent', reason: 'Торрент не появился в списке за 30 с' }])
    expect(calls.map((c) => c.path)).not.toContain('torrents/filePrio')
    const waited = deps.sleep.mock.calls.reduce((n, [ms]) => n + ms, 0)
    expect(waited).toBeGreaterThanOrEqual(30_000)
    expect(waited).toBeLessThan(31_000)
  })

  it('works with real fake timers too', async () => {
    vi.useFakeTimers()
    const { api } = setup({ info: () => [] })
    const p = addTorrents(req({ torrents: [file('slow.torrent', [true, false])] }), {
      api: api as unknown as AddDeps['api'],
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      now: () => Date.now(),
    })
    await vi.advanceTimersByTimeAsync(31_000)
    expect((await p).failed).toHaveLength(1)
  })

  it('"Fails." means already added or a bad file', async () => {
    const { deps } = setup({ add: () => 'Fails.' })
    const res = await addTorrents(req({ torrents: [file('dup.torrent')] }), deps)
    expect(res.failed).toEqual([{ name: 'dup.torrent', reason: 'Уже добавлен или неверный файл' }])
  })

  it('an HTTP error for a bad file is reported the same way', async () => {
    const { deps } = setup({ add: () => new ApiError(415) })
    const res = await addTorrents(req({ torrents: [file('bad.torrent')] }), deps)
    expect(res.failed[0].reason).toBe('Уже добавлен или неверный файл')
  })

  it('several files, one fails: the rest are added and the failure is named', async () => {
    const { deps, calls } = setup({ add: (n) => (n === 1 ? 'Fails.' : 'Ok.') })
    const res = await addTorrents(req({ torrents: [file('1.torrent'), file('2.torrent'), file('3.torrent')] }), deps)
    expect(res.added).toBe(2)
    expect(res.failed.map((f) => f.name)).toEqual(['2.torrent'])
    expect(calls.filter((c) => c.path === 'torrents/add')).toHaveLength(3)
  })

  it('magnets go in one request, one per line', async () => {
    const { deps, calls } = setup()
    const res = await addTorrents(req({ magnets: ['magnet:?xt=urn:btih:aa', 'magnet:?xt=urn:btih:bb'] }), deps)
    expect(res).toEqual({ added: 2, failed: [] })
    expect(calls).toHaveLength(1)
    expect(calls[0].form.urls).toBe('magnet:?xt=urn:btih:aa\nmagnet:?xt=urn:btih:bb')
    expect(calls[0].form).toMatchObject({ stopped: 'false', paused: 'false' })
  })

  it('a network error is a failure of that item, not an exception', async () => {
    const { deps } = setup({ add: () => new TypeError('x') })
    const res = await addTorrents(req({ magnets: ['magnet:?xt=urn:btih:aa'] }), deps)
    expect(res.added).toBe(0)
    expect(res.failed).toHaveLength(1)
  })
})

describe('reportAddResult', () => {
  it('toasts each failure with its name', async () => {
    const toasts: string[] = []
    reportAddResult({ added: 0, failed: [{ name: 'x.torrent', reason: 'Плохо' }] }, (m) => toasts.push(m))
    expect(toasts).toEqual(['x.torrent: Плохо'])
  })
  it('is silent on success', () => {
    const toast = vi.fn()
    reportAddResult({ added: 2, failed: [] }, toast)
    expect(toast).not.toHaveBeenCalled()
  })
})
