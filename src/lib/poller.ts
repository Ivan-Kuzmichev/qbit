const HIDDEN_INTERVAL_MS = 10_000

/**
 * Runs `fn` repeatedly; the next call is scheduled only after the previous one settles,
 * so slow requests never overlap. A rejection does not stop polling.
 */
export function createPoller(fn: () => Promise<void>, intervalMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let running = false

  async function tick() {
    timer = null
    try {
      await fn()
    } catch {
      // the caller handles errors; polling carries on
    }
    if (!running) return
    const hidden = typeof document !== 'undefined' && document.hidden
    timer = setTimeout(tick, hidden ? HIDDEN_INTERVAL_MS : intervalMs)
  }

  return {
    start() {
      if (running) return
      running = true
      void tick()
    },
    stop() {
      running = false
      if (timer !== null) clearTimeout(timer)
      timer = null
    },
  }
}
