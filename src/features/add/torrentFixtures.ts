// Test helper: builds .torrent bytes. Not shipped (only imported from tests).
import { createHash } from 'node:crypto'

type V = number | string | Uint8Array | V[] | Map<string, V> | { [k: string]: V }

const te = new TextEncoder()

/** Bencode with keys in the order given (not sorted), so tests can build non-canonical files. */
export function enc(v: V): Uint8Array {
  if (typeof v === 'number') return te.encode(`i${v}e`)
  if (typeof v === 'string') return enc(te.encode(v))
  // isView, not instanceof: under jsdom TextEncoder returns an array from another realm
  if (ArrayBuffer.isView(v)) return concat([te.encode(`${v.length}:`), v as Uint8Array])
  if (Array.isArray(v)) return concat([te.encode('l'), ...v.map(enc), te.encode('e')])
  const entries = v instanceof Map ? [...v.entries()] : Object.entries(v)
  return concat([te.encode('d'), ...entries.flatMap(([k, x]) => [enc(k), enc(x)]), te.encode('e')])
}

export function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

export const sha1hex = (b: Uint8Array) => createHash('sha1').update(b).digest('hex')
export const sha256hex = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')

const pieces = new Uint8Array(20).fill(7)

export function torrentBytes(info: { [k: string]: V }, extra: { [k: string]: V } = {}): { bytes: Uint8Array; infoBytes: Uint8Array } {
  const infoBytes = enc(info)
  // info is placed in the middle on purpose, between other keys
  const bytes = concat([te.encode('d'), enc('announce'), enc('http://t/a'), enc('info'), infoBytes, ...Object.entries(extra).flatMap(([k, x]) => [enc(k), enc(x)]), te.encode('e')])
  return { bytes, infoBytes }
}

export const singleInfo = { length: 1000, name: 'one.bin', 'piece length': 16384, pieces }
export const multiInfo = {
  files: [
    { length: 10, path: ['a.txt'] },
    { length: 20, path: ['sub', 'b.txt'] },
    { length: 30, path: ['c.bin'] },
  ],
  name: 'multi',
  'piece length': 16384,
  pieces,
}
export const v2Info = {
  'file tree': { 'x.bin': { '': { length: 500, 'pieces root': new Uint8Array(32) } }, dir: { 'y.bin': { '': { length: 700 } } } },
  'meta version': 2,
  name: 'v2only',
  'piece length': 16384,
}
