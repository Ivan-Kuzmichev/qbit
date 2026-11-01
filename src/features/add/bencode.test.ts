import { describe, expect, it } from 'vitest'
import { BencodeError, decode, decodeWithSpans } from './bencode'
import { enc } from './torrentFixtures'

const te = new TextEncoder()
const td = new TextDecoder()

describe('decode', () => {
  it('reads integers, strings, lists and dicts', () => {
    const v = decode(te.encode('d1:ai-5e1:bl3:abci0eee')) as { a: number; b: unknown[] }
    expect(v.a).toBe(-5)
    expect(td.decode(v.b[0] as Uint8Array)).toBe('abc')
    expect(v.b[1]).toBe(0)
  })

  it('keeps strings as raw bytes', () => {
    const v = decode(enc(new Uint8Array([0xff, 0x00, 0xfe]))) as Uint8Array
    expect([...v]).toEqual([0xff, 0, 0xfe])
  })

  it('records where each top-level value starts and ends', () => {
    const bytes = te.encode('d1:ai1e4:infod1:xi2eee')
    const { spans } = decodeWithSpans(bytes)
    const [s, e] = spans.info
    expect(td.decode(bytes.subarray(s, e))).toBe('d1:xi2ee')
  })

  it.each([
    ['empty', ''],
    ['truncated string', '5:abc'],
    ['truncated dict', 'd1:ai1e'],
    ['unterminated int', 'i12'],
    ['bad int', 'i1x2e'],
    ['leading zero', 'i012e'],
    ['not bencode', 'hello world'],
    ['non-string key', 'di1ei2ee'],
  ])('rejects %s', (_n, s) => {
    expect(() => decode(te.encode(s))).toThrow(BencodeError)
  })

  it('rejects absurd nesting without overflowing the stack', () => {
    expect(() => decode(te.encode('l'.repeat(50_000)))).toThrow(BencodeError)
  })
})
