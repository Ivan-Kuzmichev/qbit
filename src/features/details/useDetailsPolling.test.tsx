// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { json, stubFetch } from '../../test/fetchStub'
import { useDetailsPolling, type DetailsTab } from './useDetailsPolling'

const toastMock = vi.hoisted(() => vi.fn())
vi.mock('../../components/ui/Toast', () => ({ toast: toastMock }))

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  toastMock.mockClear()
})

const paths = (f: ReturnType<typeof stubFetch>) => f.mock.calls.map((c) => String(c[0]).replace(/^.*api\/v2\//, '').replace(/\?.*$/, ''))
const count = (f: ReturnType<typeof stubFetch>, p: string) => paths(f).filter((x) => x === p).length
const flush = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))

function routes(extra: Record<string, (url: string) => Response> = {}) {
  return stubFetch({
    'torrents/properties': () => json({ save_path: '/d', name: 'x' }),
    'torrents/files': () => json([{ index: 0, name: 'a' }]),
    'torrents/pieceStates': () => json([2, 1, 0]),
    'torrents/trackers': () => json([{ url: 'http://t' }]),
    'sync/torrentPeers': () => json({ rid: 1, full_update: true, peers: { '1.1.1.1:1': { ip: '1.1.1.1', port: 1 } }, show_flags: true }),
    ...extra,
  })
}

describe('useDetailsPolling', () => {
  it('polls properties, files and pieces every 2 s on the files tab, and nothing else', async () => {
    const f = routes()
    const { result, unmount } = renderHook(() => useDetailsPolling('a', 'files'))
    await flush(0)
    expect(result.current.properties?.save_path).toBe('/d')
    expect(result.current.files).toHaveLength(1)
    expect(result.current.pieces).toEqual([2, 1, 0])
    await flush(2000)
    expect(count(f, 'torrents/properties')).toBe(2)
    expect(count(f, 'torrents/files')).toBe(2)
    expect(count(f, 'torrents/pieceStates')).toBe(2)
    expect(count(f, 'torrents/trackers')).toBe(0)
    expect(count(f, 'sync/torrentPeers')).toBe(0)
    unmount()
  })

  it('merges a partial peer update into the stored peer and keeps untouched peers as the same object', async () => {
    let n = 0
    routes({
      'sync/torrentPeers': () => {
        n++
        return n === 1
          ? json({ rid: 1, full_update: true, peers: { 'a:1': { ip: 'a', port: 1, progress: 0.1 }, 'b:2': { ip: 'b', port: 2, progress: 0.2 } } })
          : json({ rid: 2, peers: { 'a:1': { progress: 0.5 } } })
      },
    })
    const { result, unmount } = renderHook(() => useDetailsPolling('a', 'peers'))
    await flush(0)
    const before = result.current.peers
    await flush(2000)
    const [a, b] = result.current.peers
    expect(a).toMatchObject({ ip: 'a', port: 1, progress: 0.5 })
    expect(b).toBe(before[1])
    unmount()
  })

  it('polls peers every 2 s with rid, merging increments', async () => {
    let n = 0
    const urls: string[] = []
    routes({
      'sync/torrentPeers': (url) => {
        urls.push(url)
        n++
        return n === 1
          ? json({ rid: 1, full_update: true, peers: { 'a:1': { ip: 'a', port: 1 } } })
          : json({ rid: 2, peers: { 'b:2': { ip: 'b', port: 2 } }, peers_removed: ['a:1'] })
      },
    })
    const { result, unmount } = renderHook(() => useDetailsPolling('a', 'peers'))
    await flush(0)
    expect(urls[0]).toContain('rid=0')
    expect(result.current.peers.map((p) => p.ip)).toEqual(['a'])
    await flush(2000)
    expect(urls[1]).toContain('rid=1')
    expect(result.current.peers.map((p) => p.ip)).toEqual(['b'])
    unmount()
  })

  it('resets rid when the torrent changes', async () => {
    const urls: string[] = []
    routes({
      'sync/torrentPeers': (url) => {
        urls.push(url)
        return json({ rid: 5, full_update: true, peers: {} })
      },
    })
    const { rerender, unmount } = renderHook(({ h }) => useDetailsPolling(h, 'peers'), { initialProps: { h: 'a' } })
    await flush(0)
    rerender({ h: 'b' })
    await flush(0)
    expect(urls[1]).toContain('hash=b')
    expect(urls[1]).toContain('rid=0')
    unmount()
  })

  it('polls trackers every 5 s', async () => {
    const f = routes()
    const { result, unmount } = renderHook(() => useDetailsPolling('a', 'trackers'))
    await flush(0)
    expect(result.current.trackers).toHaveLength(1)
    await flush(2000)
    expect(count(f, 'torrents/trackers')).toBe(1)
    await flush(3000)
    expect(count(f, 'torrents/trackers')).toBe(2)
    expect(count(f, 'torrents/files')).toBe(1) // the one-off read only
    unmount()
  })

  it('stops polling a closed tab', async () => {
    const f = routes()
    const { rerender, unmount } = renderHook(({ tab }: { tab: DetailsTab }) => useDetailsPolling('a', tab), {
      initialProps: { tab: 'peers' as DetailsTab },
    })
    await flush(0)
    rerender({ tab: 'info' })
    const before = count(f, 'sync/torrentPeers')
    await flush(6000)
    expect(count(f, 'sync/torrentPeers')).toBe(before)
    expect(count(f, 'torrents/files')).toBe(1) // the one-off read only
    unmount()
  })

  it('reads the file list once on a non-Files tab, without polling it', async () => {
    const f = routes()
    const { result, unmount } = renderHook(() => useDetailsPolling('a', 'peers'))
    await flush(0)
    expect(result.current.files).toHaveLength(1)
    await flush(6000)
    expect(count(f, 'torrents/files')).toBe(1)
    unmount()
  })

  it('does not refetch pieces when only the tab changes', async () => {
    const f = routes()
    const { rerender, unmount } = renderHook(({ tab }: { tab: DetailsTab }) => useDetailsPolling('a', tab), {
      initialProps: { tab: 'files' as DetailsTab },
    })
    await flush(0)
    rerender({ tab: 'peers' })
    await flush(0)
    rerender({ tab: 'info' })
    await flush(0)
    expect(count(f, 'torrents/pieceStates')).toBe(1)
    expect(count(f, 'torrents/properties')).toBe(1)
    unmount()
  })

  it('polls nothing without a hash', async () => {
    const f = routes()
    const { unmount } = renderHook(() => useDetailsPolling(null, 'files'))
    await flush(5000)
    expect(f).not.toHaveBeenCalled()
    unmount()
  })

  it('discards a late response of the previous torrent', async () => {
    let release: (r: Response) => void = () => {}
    routes({
      'torrents/properties': (url) =>
        url.includes('hash=a')
          ? (new Promise<Response>((res) => (release = res)) as unknown as Response)
          : json({ save_path: '/b' }),
    })
    const { result, rerender, unmount } = renderHook(({ h }) => useDetailsPolling(h, 'info'), { initialProps: { h: 'a' } })
    await flush(0)
    rerender({ h: 'b' })
    await flush(0)
    expect(result.current.properties?.save_path).toBe('/b')
    await act(async () => release(json({ save_path: '/a' })))
    await flush(0)
    expect(result.current.properties?.save_path).toBe('/b')
    unmount()
  })

  it('clears old data at once on torrent change', async () => {
    routes()
    const { result, rerender, unmount } = renderHook(({ h }) => useDetailsPolling(h, 'files'), { initialProps: { h: 'a' } })
    await flush(0)
    expect(result.current.properties).not.toBeNull()
    rerender({ h: 'b' })
    expect(result.current.properties).toBeNull()
    expect(result.current.pieces).toEqual([])
    unmount()
  })

  it('stops on 404 without a toast', async () => {
    const f = routes({ 'torrents/properties': () => new Response('', { status: 404 }) })
    const { unmount } = renderHook(() => useDetailsPolling('a', 'info'))
    await flush(0)
    await flush(10_000)
    expect(count(f, 'torrents/properties')).toBe(1)
    expect(toastMock).not.toHaveBeenCalled()
    unmount()
  })

  it('keeps polling after a network error', async () => {
    let n = 0
    const f = routes({
      'torrents/properties': () => {
        n++
        if (n === 1) throw new TypeError('offline')
        return json({ save_path: '/d' })
      },
    })
    const { unmount } = renderHook(() => useDetailsPolling('a', 'info'))
    await flush(0)
    await flush(2000)
    expect(count(f, 'torrents/properties')).toBe(2)
    unmount()
  })
})
