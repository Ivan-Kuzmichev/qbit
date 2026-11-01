import { describe, expect, it } from 'vitest'
import { compressPieces } from './compressPieces'

describe('compressPieces', () => {
  it('returns 100 empty cells for no pieces', () => {
    const out = compressPieces([])
    expect(out).toHaveLength(100)
    expect(out.every((c) => c === 'none')).toBe(true)
  })

  it('maps 5 pieces onto 100 cells without empty ranges', () => {
    const out = compressPieces([2, 2, 1, 0, 2])
    expect(out).toHaveLength(100)
    expect(out[0]).toBe('done')
    expect(out[19]).toBe('done')
    expect(out[20]).toBe('done')
    expect(out[40]).toBe('active')
    expect(out[60]).toBe('none')
    expect(out[99]).toBe('done')
  })

  it('marks a cell done when more than half of its pieces are done', () => {
    const states = [...Array(300).fill(0)]
    // cell 0 covers pieces 0..2
    states[0] = 2
    states[1] = 2
    expect(compressPieces(states)[0]).toBe('done')
  })

  it('prefers done over active', () => {
    const out = compressPieces([2, 2, 1, ...Array(297).fill(0)])
    expect(out[0]).toBe('done')
  })

  it('marks active when half or fewer are done and some are in progress', () => {
    expect(compressPieces([2, 1, ...Array(298).fill(0)])[0]).toBe('active')
    expect(compressPieces([1, 0, 0, ...Array(297).fill(0)])[0]).toBe('active')
  })

  it('leaves a cell with only a few done pieces and none in progress as none', () => {
    expect(compressPieces([2, 0, 0, ...Array(297).fill(0)])[0]).toBe('none')
  })

  it('handles 150 000 pieces in under 20 ms', () => {
    const states = Array.from({ length: 150_000 }, (_, i) => i % 3)
    const start = performance.now()
    compressPieces(states)
    expect(performance.now() - start).toBeLessThan(20)
  })
})
