// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Torrent } from '../../api/types'
import { emptySync } from '../../store/mergeMainData'
import { useTorrents } from '../../store/torrents'
import { json, stubFetch, text } from '../../test/fetchStub'
import { pauseAllLabel, runBulkPause, runRowAction, runTorrentAction, targetHashes } from './actions'

const toastMock = vi.hoisted(() => vi.fn())
vi.mock('../../components/ui/Toast', () => ({ toast: toastMock }))

const tor = (hash: string, state: string): Torrent => ({ hash, state, progress: 0.5 }) as Torrent

const refresh = vi.fn().mockResolvedValue(undefined)
beforeEach(() => {
  toastMock.mockClear()
  refresh.mockClear()
  useTorrents.setState({ ...emptySync, selected: new Set(), anchor: null, refresh })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function body(fn: ReturnType<typeof stubFetch>, call = 0): URLSearchParams {
  return new URLSearchParams(String(fn.mock.calls[call][1]?.body))
}

describe('targetHashes', () => {
  it('is the selection, empty when nothing is selected', () => {
    expect(targetHashes({ selected: new Set() })).toEqual([])
    expect(targetHashes({ selected: new Set(['a', 'b']) })).toEqual(['a', 'b'])
  })
})

describe('runRowAction', () => {
  it('forceStart sends setForceStart with value=true', async () => {
    const f = stubFetch({ 'torrents/setForceStart': () => text('') })
    await runRowAction(tor('a', 'queuedDL'), 'forceStart')
    expect(body(f).get('hashes')).toBe('a')
    expect(body(f).get('value')).toBe('true')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['stop', 'torrents/stop'],
    ['start', 'torrents/start'],
    ['recheck', 'torrents/recheck'],
  ] as const)('%s posts to %s for the row only', async (action, path) => {
    const f = stubFetch({ [path]: () => text('') })
    await runRowAction(tor('a', 'stoppedDL'), action)
    expect(String(f.mock.calls[0][0])).toContain(path)
    expect(body(f).get('hashes')).toBe('a')
  })

  it('shows a toast on failure and still does not throw', async () => {
    stubFetch({ 'torrents/stop': () => json({}, 500) })
    await expect(runRowAction(tor('a', 'downloading'), 'stop')).resolves.toBeUndefined()
    expect(toastMock).toHaveBeenCalledTimes(1)
  })
})

describe('runTorrentAction', () => {
  it('does nothing without hashes', async () => {
    const f = stubFetch({})
    await runTorrentAction('torrents/recheck', [])
    expect(f).not.toHaveBeenCalled()
  })

  it('joins hashes with | and refreshes', async () => {
    const f = stubFetch({ 'torrents/addTags': () => text('') })
    await runTorrentAction('torrents/addTags', ['a', 'b'], { tags: 'x' })
    expect(body(f).get('hashes')).toBe('a|b')
    expect(body(f).get('tags')).toBe('x')
    expect(refresh).toHaveBeenCalled()
  })
})

describe('runBulkPause', () => {
  it('sends hashes=all without a selection', async () => {
    const f = stubFetch({ 'torrents/stop': () => text('') })
    await runBulkPause('stop')
    expect(body(f).get('hashes')).toBe('all')
  })

  it('sends the selected hashes when there is a selection', async () => {
    useTorrents.setState({ torrents: { a: tor('a', 'stoppedDL'), b: tor('b', 'stoppedDL') }, selected: new Set(['a', 'b']) })
    const f = stubFetch({ 'torrents/start': () => text('') })
    await runBulkPause('start')
    expect(body(f).get('hashes')).toBe('a|b')
  })
})

describe('runBulkPause with a stale selection', () => {
  it('sends only the selected hashes that still exist', async () => {
    useTorrents.setState({ torrents: { a: tor('a', 'downloading') }, selected: new Set(['a', 'gone']) })
    const f = stubFetch({ 'torrents/stop': () => text('') })
    await runBulkPause('stop')
    expect(body(f).get('hashes')).toBe('a')
  })

  it('falls back to all when no selected hash exists any more', async () => {
    useTorrents.setState({ torrents: { a: tor('a', 'downloading') }, selected: new Set(['gone']) })
    const f = stubFetch({ 'torrents/stop': () => text('') })
    await runBulkPause('stop')
    expect(body(f).get('hashes')).toBe('all')
  })
})

describe('runTorrentAction when refresh fails', () => {
  it('does not report a successful action as failed', async () => {
    refresh.mockRejectedValueOnce(new Error('network'))
    stubFetch({ 'torrents/stop': () => text('') })
    await runTorrentAction('torrents/stop', ['a'])
    expect(toastMock).not.toHaveBeenCalled()
  })
})

describe('pauseAllLabel', () => {
  it('is "start" only when every torrent is paused', () => {
    expect(pauseAllLabel([tor('a', 'stoppedDL'), tor('b', 'stoppedUP')])).toBe('start')
    expect(pauseAllLabel([tor('a', 'stoppedDL'), tor('b', 'downloading')])).toBe('pause')
    expect(pauseAllLabel([])).toBe('pause')
  })
})
