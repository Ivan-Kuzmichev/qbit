import { describe, expect, it } from 'vitest'
import type { Torrent } from '../../api/types'
import { ALL_FILTER } from './filters'
import { selectVisible, sortTorrents } from './sortTorrents'

const tor = (hash: string, extra: Partial<Torrent> = {}): Torrent =>
  ({ hash, name: hash, state: 'stoppedDL', progress: 0, size: 0, dlspeed: 0, upspeed: 0, added_on: 0, category: '', tags: '', ...extra }) as Torrent

const hashes = (l: Torrent[]) => l.map((x) => x.hash)

describe('sortTorrents', () => {
  it('sorts by the column in the given direction', () => {
    const l = [tor('a', { size: 2 }), tor('b', { size: 3 }), tor('c', { size: 1 })]
    expect(hashes(sortTorrents(l, { key: 'size', dir: 'asc' }))).toEqual(['c', 'a', 'b'])
    expect(hashes(sortTorrents(l, { key: 'size', dir: 'desc' }))).toEqual(['b', 'a', 'c'])
  })
  it('breaks ties by hash in both directions so rows do not jump', () => {
    const l = [tor('c', { size: 1 }), tor('a', { size: 1 }), tor('b', { size: 1 })]
    expect(hashes(sortTorrents(l, { key: 'size', dir: 'asc' }))).toEqual(['a', 'b', 'c'])
    expect(hashes(sortTorrents(l, { key: 'size', dir: 'desc' }))).toEqual(['a', 'b', 'c'])
    expect(hashes(sortTorrents([...l].reverse(), { key: 'size', dir: 'asc' }))).toEqual(['a', 'b', 'c'])
  })
  it('sorts names with a locale-aware, case-insensitive compare', () => {
    const l = [tor('1', { name: 'Яблоко' }), tor('2', { name: 'арбуз' }), tor('3', { name: 'Банан' })]
    expect(sortTorrents(l, { key: 'name', dir: 'asc' }).map((x) => x.name)).toEqual(['арбуз', 'Банан', 'Яблоко'])
  })
  it('sorts speed by the shown value: download first, then upload', () => {
    const l = [tor('a', { upspeed: 50 }), tor('b', { dlspeed: 10, upspeed: 999 }), tor('c')]
    expect(hashes(sortTorrents(l, { key: 'speed', dir: 'desc' }))).toEqual(['a', 'b', 'c'])
  })
  it('does not mutate the input', () => {
    const l = [tor('b', { size: 2 }), tor('a', { size: 1 })]
    sortTorrents(l, { key: 'size', dir: 'asc' })
    expect(hashes(l)).toEqual(['b', 'a'])
  })
})

describe('selectVisible', () => {
  const torrents = {
    a: tor('a', { name: 'Ubuntu ISO', added_on: 1 }),
    b: tor('b', { name: 'Дебиан образ', added_on: 3, category: 'linux' }),
    c: tor('c', { name: 'Sintel', added_on: 2, state: 'downloading' }),
  }
  const ui = { filter: ALL_FILTER, search: '', sort: { key: 'added_on', dir: 'desc' as const } }

  it('defaults to added_on, newest first', () => {
    expect(hashes(selectVisible({ torrents }, ui))).toEqual(['b', 'c', 'a'])
  })
  it('searches names case-insensitively, Cyrillic included', () => {
    expect(hashes(selectVisible({ torrents }, { ...ui, search: 'UBUNTU' }))).toEqual(['a'])
    expect(hashes(selectVisible({ torrents }, { ...ui, search: 'ДЕБИАН' }))).toEqual(['b'])
    expect(hashes(selectVisible({ torrents }, { ...ui, search: '  sin ' }))).toEqual(['c'])
  })
  it('applies the sidebar filter', () => {
    expect(hashes(selectVisible({ torrents }, { ...ui, filter: { type: 'category', value: 'linux' } }))).toEqual(['b'])
    expect(hashes(selectVisible({ torrents }, { ...ui, filter: { type: 'status', value: 'downloading' } }))).toEqual(['c'])
  })
})
