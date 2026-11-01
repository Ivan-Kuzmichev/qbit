import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, NetworkError } from '../api/client'
import type { MainData } from '../api/types'
import { emptySync } from './mergeMainData'
import { useTorrents } from './torrents'

const get = vi.spyOn(api, 'get')

const t = (hash: string) => ({ hash, name: hash })

beforeEach(() => {
  get.mockReset()
  useTorrents.setState({
    ...emptySync,
    speedHistory: [],
    connection: 'ok',
    selected: new Set(),
    anchor: null,
  })
})
afterEach(() => useTorrents.getState().stopSync())

describe('refresh', () => {
  it('requests sync/maindata with current rid and merges', async () => {
    get.mockResolvedValueOnce({ rid: 3, full_update: true, torrents: { a: t('a') } } satisfies MainData)
    await useTorrents.getState().refresh()
    expect(get).toHaveBeenCalledWith('sync/maindata', { rid: 0 })
    expect(useTorrents.getState().rid).toBe(3)
    get.mockResolvedValueOnce({ rid: 4 })
    await useTorrents.getState().refresh()
    expect(get).toHaveBeenLastCalledWith('sync/maindata', { rid: 3 })
  })
  it('NetworkError -> lost, rid kept; next success -> ok', async () => {
    get.mockResolvedValueOnce({ rid: 5, full_update: true })
    await useTorrents.getState().refresh()
    get.mockRejectedValueOnce(new NetworkError())
    await useTorrents.getState().refresh()
    expect(useTorrents.getState().connection).toBe('lost')
    expect(useTorrents.getState().rid).toBe(5)
    get.mockResolvedValueOnce({ rid: 6 })
    await useTorrents.getState().refresh()
    expect(useTorrents.getState().connection).toBe('ok')
  })
  it('other errors propagate', async () => {
    get.mockRejectedValueOnce(new Error('x'))
    await expect(useTorrents.getState().refresh()).rejects.toThrow('x')
  })
  it('speed history holds at most 60 points', async () => {
    for (let i = 1; i <= 65; i++) {
      get.mockResolvedValueOnce({
        rid: i,
        server_state: { dl_info_speed: i, up_info_speed: i * 2 },
      })
      await useTorrents.getState().refresh()
    }
    const h = useTorrents.getState().speedHistory
    expect(h).toHaveLength(60)
    expect(h[59]).toEqual({ dl: 65, up: 130 })
    expect(h[0]).toEqual({ dl: 6, up: 12 })
  })
  it('removed torrent leaves the selection', async () => {
    get.mockResolvedValueOnce({
      rid: 1,
      full_update: true,
      torrents: { a: t('a'), b: t('b') },
    })
    await useTorrents.getState().refresh()
    useTorrents.getState().select('a', 'single', ['a', 'b'])
    useTorrents.getState().select('b', 'toggle', ['a', 'b'])
    get.mockResolvedValueOnce({ rid: 2, torrents_removed: ['a'] })
    await useTorrents.getState().refresh()
    expect([...useTorrents.getState().selected]).toEqual(['b'])
    expect(useTorrents.getState().anchor).toBe('b')
  })
  it('full_update dropping a torrent also clears it from selection', async () => {
    useTorrents.setState({ torrents: { a: t('a') } as never, selected: new Set(['a']), anchor: 'a' })
    get.mockResolvedValueOnce({ rid: 9, full_update: true, torrents: {} })
    await useTorrents.getState().refresh()
    expect(useTorrents.getState().selected.size).toBe(0)
    expect(useTorrents.getState().anchor).toBeNull()
  })
})

describe('stopSync', () => {
  it('drops the response of a refresh that was in flight', async () => {
    let resolve!: (v: MainData) => void
    get.mockReturnValueOnce(new Promise<MainData>((r) => (resolve = r)))
    const pending = useTorrents.getState().refresh()
    useTorrents.getState().stopSync()
    resolve({ rid: 7, full_update: true, torrents: { a: t('a') } })
    await pending
    expect(useTorrents.getState().rid).toBe(0)
    expect(useTorrents.getState().torrents).toEqual({})
  })
  it('does not flag connection lost for a request that was in flight', async () => {
    let reject!: (e: Error) => void
    get.mockReturnValueOnce(new Promise<MainData>((_, r) => (reject = r)))
    const pending = useTorrents.getState().refresh()
    useTorrents.getState().stopSync()
    reject(new NetworkError())
    await pending
    expect(useTorrents.getState().connection).toBe('ok')
  })
})

describe('select', () => {
  const order = ['a', 'b', 'c', 'd', 'e']
  it('single replaces selection', () => {
    const s = useTorrents.getState()
    s.select('a', 'single', order)
    s.select('c', 'single', order)
    expect([...useTorrents.getState().selected]).toEqual(['c'])
  })
  it('toggle adds and removes', () => {
    const s = useTorrents.getState()
    s.select('a', 'single', order)
    s.select('c', 'toggle', order)
    expect([...useTorrents.getState().selected].sort()).toEqual(['a', 'c'])
    s.select('a', 'toggle', order)
    expect([...useTorrents.getState().selected]).toEqual(['c'])
  })
  it('range selects between anchor and target by given order, both directions', () => {
    const s = useTorrents.getState()
    s.select('b', 'single', order)
    s.select('d', 'range', order)
    expect([...useTorrents.getState().selected]).toEqual(['b', 'c', 'd'])
    expect(useTorrents.getState().anchor).toBe('b')
    s.select('a', 'range', order)
    expect([...useTorrents.getState().selected]).toEqual(['a', 'b'])
  })
  it('range without anchor selects just the target', () => {
    useTorrents.getState().select('c', 'range', order)
    expect([...useTorrents.getState().selected]).toEqual(['c'])
  })
  it('clearSelection empties', () => {
    useTorrents.getState().select('a', 'single', order)
    useTorrents.getState().clearSelection()
    expect(useTorrents.getState().selected.size).toBe(0)
    expect(useTorrents.getState().anchor).toBeNull()
  })
})
