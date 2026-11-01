import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPoller } from './poller'

let hidden = false
beforeEach(() => {
  vi.useFakeTimers()
  hidden = false
  vi.stubGlobal('document', {
    get hidden() {
      return hidden
    },
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('createPoller', () => {
  it('calls fn immediately, then every interval after completion', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const p = createPoller(fn, 1000)
    p.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(fn).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenCalledTimes(2)
    p.stop()
  })
  it('does not overlap a slow request', async () => {
    let release!: () => void
    const fn = vi.fn(() => new Promise<void>((r) => (release = r)))
    const p = createPoller(fn, 1000)
    p.start()
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).toHaveBeenCalledTimes(1)
    release()
    await vi.advanceTimersByTimeAsync(999)
    expect(fn).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fn).toHaveBeenCalledTimes(2)
    p.stop()
  })
  it('uses 10 s when the document is hidden', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const p = createPoller(fn, 1000)
    hidden = true
    p.start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(9999)
    expect(fn).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fn).toHaveBeenCalledTimes(2)
    p.stop()
  })
  it('stop cancels the timer', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const p = createPoller(fn, 1000)
    p.start()
    await vi.advanceTimersByTimeAsync(0)
    p.stop()
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).toHaveBeenCalledTimes(1)
  })
  it('stop while a request is in flight prevents rescheduling', async () => {
    let release!: () => void
    const fn = vi.fn(() => new Promise<void>((r) => (release = r)))
    const p = createPoller(fn, 1000)
    p.start()
    await vi.advanceTimersByTimeAsync(0)
    p.stop()
    release()
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).toHaveBeenCalledTimes(1)
  })
  it('a rejection does not stop polling', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'))
    const p = createPoller(fn, 1000)
    p.start()
    await vi.advanceTimersByTimeAsync(3000)
    expect(fn).toHaveBeenCalledTimes(4)
    p.stop()
  })
  it('stop then start while a request is pending neither overlaps nor doubles the loop', async () => {
    const releases: (() => void)[] = []
    let active = 0
    let maxActive = 0
    const fn = vi.fn(() => {
      active++
      maxActive = Math.max(maxActive, active)
      return new Promise<void>((r) => releases.push(() => { active--; r() }))
    })
    const p = createPoller(fn, 1000)
    p.start()
    await vi.advanceTimersByTimeAsync(0)
    p.stop()
    p.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(fn).toHaveBeenCalledTimes(1)
    releases[0]()
    await vi.advanceTimersByTimeAsync(0)
    expect(fn).toHaveBeenCalledTimes(2)
    releases[1]()
    await vi.advanceTimersByTimeAsync(3000)
    releases.slice(2).forEach((r) => r())
    // one loop only: ~1 call per second
    expect(fn.mock.calls.length).toBeLessThanOrEqual(5)
    p.stop()
    const n = fn.mock.calls.length
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).toHaveBeenCalledTimes(n)
    expect(maxActive).toBe(1)
  })
  it('start twice does not double the loop', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const p = createPoller(fn, 1000)
    p.start()
    p.start()
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenCalledTimes(2)
    p.stop()
  })
})
