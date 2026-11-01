import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sha1, sha256 } from './hash'

const ref = (alg: string, b: Uint8Array) => createHash(alg).update(b).digest('hex')

const inputs: Uint8Array[] = [
  new Uint8Array(),
  new TextEncoder().encode('abc'),
  new TextEncoder().encode('a'.repeat(55)),
  new TextEncoder().encode('a'.repeat(56)),
  new TextEncoder().encode('a'.repeat(64)),
  new TextEncoder().encode('a'.repeat(119)),
  Uint8Array.from({ length: 100_000 }, (_, i) => (i * 31) & 0xff),
]

afterEach(() => vi.unstubAllGlobals())

describe('hash', () => {
  it.each(inputs.map((b) => [b.length, b] as const))('sha1 matches node:crypto (%i bytes)', (_n, b) => {
    expect(sha1(b)).toBe(ref('sha1', b))
  })
  it.each(inputs.map((b) => [b.length, b] as const))('sha256 matches node:crypto (%i bytes)', (_n, b) => {
    expect(sha256(b)).toBe(ref('sha256', b))
  })
  it('works where crypto.subtle is missing (plain HTTP)', () => {
    vi.stubGlobal('crypto', {})
    expect(sha1(inputs[1])).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
  })
})
