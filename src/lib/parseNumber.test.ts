import { describe, expect, it } from 'vitest'
import { parseDecimal, parseLimitKb, parseLimitMb } from './parseNumber'

describe('parseLimitMb', () => {
  it('parses decimals with comma or point', () => {
    expect(parseLimitMb('1,5')).toBe(1572864)
    expect(parseLimitMb('1.5')).toBe(1572864)
    expect(parseLimitMb(' 2 ')).toBe(2097152)
  })
  it('empty and ∞ mean no limit', () => {
    expect(parseLimitMb('')).toBe(0)
    expect(parseLimitMb('∞')).toBe(0)
    expect(parseLimitMb('0')).toBe(0)
  })
  it('rejects garbage', () => {
    expect(parseLimitMb('-1')).toBeNull()
    expect(parseLimitMb('abc')).toBeNull()
    expect(parseLimitMb('1,2,3')).toBeNull()
    expect(parseLimitMb('1e3')).toBeNull()
  })
})

describe('parseLimitKb', () => {
  it('KB/s -> bytes/s, comma allowed, empty is no limit', () => {
    expect(parseLimitKb('512')).toBe(524288)
    expect(parseLimitKb('0,5')).toBe(512)
    expect(parseLimitKb('')).toBe(0)
    expect(parseLimitKb('-3')).toBeNull()
  })
})

describe('parseDecimal', () => {
  it('accepts comma and point, rejects garbage and negatives', () => {
    expect(parseDecimal('2,5')).toBe(2.5)
    expect(parseDecimal('2.5')).toBe(2.5)
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('-1')).toBeNull()
    expect(parseDecimal('x')).toBeNull()
  })
})
