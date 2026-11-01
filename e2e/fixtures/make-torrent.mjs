// Regenerates e2e/fixtures/tiny.torrent (one 16 KiB file), multi.torrent (two 16 KiB files), hybrid.torrent and
// padded.torrent ([a, BEP 47 pad, b]); no reachable tracker.
// Usage: node e2e/fixtures/make-torrent.mjs
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const enc = (v) => {
  if (typeof v === 'number') return Buffer.from(`i${v}e`)
  if (typeof v === 'string') v = Buffer.from(v)
  if (Buffer.isBuffer(v)) return Buffer.concat([Buffer.from(`${v.length}:`), v])
  if (Array.isArray(v)) return Buffer.concat([Buffer.from('l'), ...v.map(enc), Buffer.from('e')])
  const keys = Object.keys(v).sort()
  return Buffer.concat([Buffer.from('d'), ...keys.flatMap((k) => [enc(k), enc(v[k])]), Buffer.from('e')])
}

const data = Buffer.alloc(16384, 'qbit-e2e')
const info = {
  length: data.length,
  name: 'qbit-e2e-tiny.bin',
  'piece length': 16384,
  pieces: createHash('sha1').update(data).digest(),
}
const torrent = { announce: 'http://127.0.0.1:1/announce', info }
writeFileSync(new URL('./tiny.torrent', import.meta.url), enc(torrent))

// Two files, each exactly one piece, so unchecking one is a clean case for the add dialog.
const a = Buffer.alloc(16384, 'qbit-e2e-a')
const b = Buffer.alloc(16384, 'qbit-e2e-b')
const multi = {
  announce: 'http://127.0.0.1:1/announce',
  info: {
    files: [
      { length: a.length, path: ['a.bin'] },
      { length: b.length, path: ['b.bin'] },
    ],
    name: 'qbit-e2e-multi',
    'piece length': 16384,
    pieces: Buffer.concat([a, b].map((d) => createHash('sha1').update(d).digest())),
  },
}
writeFileSync(new URL('./multi.torrent', import.meta.url), enc(multi))

// Hybrid (v1 + v2) twin of multi.torrent. qBittorrent files hybrids under the v2 hash,
// so this checks that the add dialog still finds the torrent after a partial selection.
const root = (d) => createHash('sha256').update(d).digest()
const hybrid = {
  announce: 'http://127.0.0.1:1/announce',
  info: {
    'file tree': { 'a.bin': { '': { length: a.length, 'pieces root': root(a) } }, 'b.bin': { '': { length: b.length, 'pieces root': root(b) } } },
    files: multi.info.files,
    'meta version': 2,
    name: 'qbit-e2e-hybrid',
    'piece length': 16384,
    pieces: multi.info.pieces,
  },
}
writeFileSync(new URL('./hybrid.torrent', import.meta.url), enc(hybrid))

// BEP 47 padding: a (10000 B) + pad (6384 B, up to the piece boundary) + b (one piece). The pad is the middle
// entry in the metainfo, so non-pad indices must run 0 and 1 in torrents/files.
const pa = Buffer.alloc(10000, 'qbit-e2e-pa')
const pad = Buffer.alloc(6384)
const pb = Buffer.alloc(16384, 'qbit-e2e-pb')
const padded = {
  announce: 'http://127.0.0.1:1/announce',
  info: {
    files: [
      { length: pa.length, path: ['a.bin'] },
      { attr: 'p', length: pad.length, path: ['.pad', String(pad.length)] },
      { length: pb.length, path: ['b.bin'] },
    ],
    name: 'qbit-e2e-padded',
    'piece length': 16384,
    pieces: Buffer.concat([Buffer.concat([pa, pad]), pb].map((d) => createHash('sha1').update(d).digest())),
  },
}
writeFileSync(new URL('./padded.torrent', import.meta.url), enc(padded))
