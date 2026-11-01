// Regenerates e2e/fixtures/tiny.torrent (one 16 KiB file) and multi.torrent (two 16 KiB files); no reachable tracker.
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
