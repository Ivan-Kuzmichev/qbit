import { describe, expect, it } from 'vitest'
import { parseLimitMb } from './parseNumber'

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
