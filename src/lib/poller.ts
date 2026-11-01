const HIDDEN_INTERVAL_MS = 10_000

/**
 * Runs `fn` repeatedly; the next call is scheduled only after the previous one settles,
 * so slow requests never overlap. A rejection does not stop polling.
 */
export function createPoller(fn: () => Promise<void>, intervalMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let running = false
  let inflight = false
  let generation = 0

  async function tick(gen: number) {
    timer = null
    inflight = true
    try {
      await fn()
    } catch {
      // the caller handles errors; polling carries on
    } finally {
      inflight = false
    }
    if (!running) return
    if (gen !== generation) {
      // stop() then start() happened while this call was pending: continue as the new loop
      void tick(generation)
      return
    }
    const hidden = typeof document !== 'undefined' && document.hidden
    timer = setTimeout(() => void tick(gen), hidden ? HIDDEN_INTERVAL_MS : intervalMs)
  }

  return {
    start() {
      if (running) return
      running = true
      generation++
      if (!inflight) void tick(generation)
    },
    stop() {
      running = false
      if (timer !== null) clearTimeout(timer)
      timer = null
    },
  }
}
