import { describe, expect, it } from 'vitest'
import type { Torrent } from '../../api/types'
import { countByFilter, filterKey, matchesFilter, type Filter } from './filters'

const tor = (state: string, extra: Partial<Torrent> = {}): Torrent =>
  ({ hash: state + Math.random(), state, progress: 0.5, category: '', tags: '', ...extra }) as Torrent

const all: Filter = { type: 'status', value: 'all' }

describe('matchesFilter', () => {
  it('all matches everything, including checking and moving', () => {
    for (const s of ['downloading', 'checkingUP', 'moving', 'error']) {
      expect(matchesFilter(tor(s), all)).toBe(true)
    }
  })
  it('status filters follow the UI status', () => {
    expect(matchesFilter(tor('stalledDL'), { type: 'status', value: 'downloading' })).toBe(true)
    expect(matchesFilter(tor('stalledUP'), { type: 'status', value: 'seeding' })).toBe(true)
    expect(matchesFilter(tor('stoppedUP'), { type: 'status', value: 'done' })).toBe(true)
    expect(matchesFilter(tor('stoppedUP'), { type: 'status', value: 'paused' })).toBe(false)
    expect(matchesFilter(tor('stoppedDL'), { type: 'status', value: 'paused' })).toBe(true)
  })
  it('checking and moving belong to "all" only', () => {
    for (const value of ['downloading', 'seeding', 'done', 'paused', 'queued', 'error'] as const) {
      expect(matchesFilter(tor('checkingDL'), { type: 'status', value })).toBe(false)
      expect(matchesFilter(tor('moving'), { type: 'status', value })).toBe(false)
    }
  })
  it('category matches exactly; a torrent without category does not throw', () => {
    expect(matchesFilter(tor('stoppedDL', { category: 'Movies' }), { type: 'category', value: 'Movies' })).toBe(true)
    expect(matchesFilter(tor('stoppedDL', { category: '' }), { type: 'category', value: 'Movies' })).toBe(false)
    expect(matchesFilter(tor('stoppedDL', { category: undefined as unknown as string }), { type: 'category', value: 'Movies' })).toBe(false)
  })
  it('tag matches one item of the comma separated list', () => {
    const f: Filter = { type: 'tag', value: 'hd' }
    expect(matchesFilter(tor('stoppedDL', { tags: 'a, hd ,b' }), f)).toBe(true)
    expect(matchesFilter(tor('stoppedDL', { tags: 'hdr' }), f)).toBe(false)
    expect(matchesFilter(tor('stoppedDL', { tags: '' }), f)).toBe(false)
    expect(matchesFilter(tor('stoppedDL', { tags: undefined as unknown as string }), f)).toBe(false)
  })
})

describe('countByFilter', () => {
  it('counts statuses, categories and tags', () => {
    const list = [
      tor('downloading', { category: 'A', tags: 'x,y' }),
      tor('forcedDL', { category: 'A' }),
      tor('uploading', { tags: 'x' }),
      tor('stoppedUP'),
      tor('stoppedDL'),
      tor('queuedDL'),
      tor('checkingUP'),
      tor('error'),
    ]
    const c = countByFilter(list)
    expect(c[filterKey(all)]).toBe(8)
    expect(c[filterKey({ type: 'status', value: 'downloading' })]).toBe(2)
    expect(c[filterKey({ type: 'status', value: 'seeding' })]).toBe(1)
    expect(c[filterKey({ type: 'status', value: 'done' })]).toBe(1)
    expect(c[filterKey({ type: 'status', value: 'paused' })]).toBe(1)
    expect(c[filterKey({ type: 'status', value: 'queued' })]).toBe(1)
    expect(c[filterKey({ type: 'status', value: 'error' })]).toBe(1)
    expect(c[filterKey({ type: 'category', value: 'A' })]).toBe(2)
    expect(c[filterKey({ type: 'tag', value: 'x' })]).toBe(2)
    expect(c[filterKey({ type: 'tag', value: 'y' })]).toBe(1)
  })
  it('empty list gives zero for all', () => {
    expect(countByFilter([])[filterKey(all)]).toBe(0)
  })
})
