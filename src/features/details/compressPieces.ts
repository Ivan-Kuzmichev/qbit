export type Cell = 'done' | 'active' | 'none'

export const CELLS = 100

/**
 * Squeezes qBittorrent piece states (0 missing, 1 downloading, 2 done) into 100 cells.
 * A cell is `done` when more than half of its pieces are done, otherwise `active` when
 * any of its pieces is downloading. With fewer than 100 pieces every cell still covers one.
 */
export function compressPieces(states: readonly number[]): Cell[] {
  const n = states.length
  const out: Cell[] = []
  for (let i = 0; i < CELLS; i++) {
    if (n === 0) {
      out.push('none')
      continue
    }
    const start = Math.min(n - 1, Math.floor((i * n) / CELLS))
    const end = Math.min(n, Math.max(start + 1, Math.floor(((i + 1) * n) / CELLS)))
    let done = 0
    let active = 0
    for (let k = start; k < end; k++) {
      const s = states[k]
      if (s === 2) done++
      else if (s === 1) active++
    }
    out.push(done * 2 > end - start ? 'done' : active > 0 ? 'active' : 'none')
  }
  return out
}
