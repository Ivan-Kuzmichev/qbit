import { describe, expect, it } from 'vitest'
import type { ServerState, Torrent } from '../api/types'
import { emptySync, mergeMainData, type SyncState } from './mergeMainData'

const tor = (hash: string, extra: Partial<Torrent> = {}) =>
  ({ hash, name: hash, dlspeed: 0, ...extra }) as Torrent

const base = (): SyncState => ({
  rid: 1,
  torrents: { a: tor('a', { dlspeed: 5 }), b: tor('b', { dlspeed: 7 }) },
  categories: { x: { name: 'x', savePath: '/x' } },
  tags: ['t1', 't2'],
  server: { dl_info_speed: 1, up_info_speed: 2 } as ServerState,
})

describe('mergeMainData', () => {
  it('partial update changes only received fields and keeps untouched refs', () => {
    const prev = base()
    const next = mergeMainData(prev, { rid: 2, torrents: { a: { dlspeed: 9 } } })
    expect(next.rid).toBe(2)
    expect(next.torrents.a).toEqual({ hash: 'a', name: 'a', dlspeed: 9 })
    expect(next.torrents.b).toBe(prev.torrents.b)
    expect(next.categories).toBe(prev.categories)
    expect(next.tags).toBe(prev.tags)
  })
  it('adds a new torrent from a partial update', () => {
    const next = mergeMainData(base(), { rid: 2, torrents: { c: tor('c') } })
    expect(Object.keys(next.torrents).sort()).toEqual(['a', 'b', 'c'])
  })
  it('torrents_removed, categories_removed, tags_removed delete', () => {
    const next = mergeMainData(base(), {
      rid: 2,
      torrents_removed: ['a'],
      categories_removed: ['x'],
      tags_removed: ['t1'],
    })
    expect(Object.keys(next.torrents)).toEqual(['b'])
    expect(next.categories).toEqual({})
    expect(next.tags).toEqual(['t2'])
  })
  it('merges new categories and tags without duplicates', () => {
    const next = mergeMainData(base(), {
      rid: 2,
      categories: { y: { name: 'y', savePath: '/y' } },
      tags: ['t2', 't3'],
    })
    expect(Object.keys(next.categories).sort()).toEqual(['x', 'y'])
    expect(next.tags).toEqual(['t1', 't2', 't3'])
  })
  it('server_state is merged by field', () => {
    const next = mergeMainData(base(), { rid: 2, server_state: { up_info_speed: 3 } })
    expect(next.server).toEqual({ dl_info_speed: 1, up_info_speed: 3 })
  })
  it('full_update replaces everything, including vanished torrents', () => {
    const next = mergeMainData(base(), {
      rid: 10,
      full_update: true,
      torrents: { z: tor('z') },
      server_state: { dl_info_speed: 4 },
    })
    expect(Object.keys(next.torrents)).toEqual(['z'])
    expect(next.categories).toEqual({})
    expect(next.tags).toEqual([])
    expect(next.server).toEqual({ dl_info_speed: 4 })
    expect(next.rid).toBe(10)
  })
  it('empty state merges a first full response', () => {
    const next = mergeMainData(emptySync, { rid: 1, full_update: true, torrents: { a: tor('a') } })
    expect(next.torrents.a.hash).toBe('a')
  })
})
