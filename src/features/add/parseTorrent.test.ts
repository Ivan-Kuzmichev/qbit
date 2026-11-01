import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseTorrent, TorrentParseError } from './parseTorrent'
import { enc, multiInfo, sha1hex, sha256hex, singleInfo, torrentBytes, v2Info } from './torrentFixtures'

afterEach(() => vi.unstubAllGlobals())

describe('parseTorrent', () => {
  it('reads a single-file v1 torrent', () => {
    const { bytes, infoBytes } = torrentBytes(singleInfo)
    const p = parseTorrent(bytes)
    expect(p.name).toBe('one.bin')
    expect(p.size).toBe(1000)
    expect(p.files).toEqual([{ path: 'one.bin', size: 1000 }])
    expect(p.infohash).toBe(sha1hex(infoBytes))
  })

  it('reads a multi-file torrent, paths are under the torrent name', () => {
    const p = parseTorrent(torrentBytes(multiInfo).bytes)
    expect(p.size).toBe(60)
    expect(p.files.map((f) => f.path)).toEqual(['multi/a.txt', 'multi/sub/b.txt', 'multi/c.bin'])
  })

  it('hashes the original info bytes: unsorted keys and extra keys survive', () => {
    // keys deliberately not in canonical order, plus an unknown key
    const odd = { name: 'one.bin', zzz: 'extra', length: 1000, pieces: singleInfo.pieces, 'piece length': 16384 }
    const { bytes, infoBytes } = torrentBytes(odd, { comment: 'x' })
    expect(parseTorrent(bytes).infohash).toBe(sha1hex(infoBytes))
  })

  it('v2-only: first 40 chars of SHA-256 of info, files from the file tree', () => {
    const { bytes, infoBytes } = torrentBytes(v2Info)
    const p = parseTorrent(bytes)
    expect(p.infohash).toBe(sha256hex(infoBytes).slice(0, 40))
    expect(p.size).toBe(1200)
    expect(p.files.map((f) => f.path).sort()).toEqual(['v2only/dir/y.bin', 'v2only/x.bin'])
  })

  it('hybrid: SHA-1', () => {
    const hybrid = { ...singleInfo, 'file tree': v2Info['file tree'], 'meta version': 2 }
    const { bytes, infoBytes } = torrentBytes(hybrid)
    expect(parseTorrent(bytes).infohash).toBe(sha1hex(infoBytes))
  })

  it('marks padding files', () => {
    const info = { files: [{ length: 5, path: ['a'] }, { length: 3, path: ['.pad', '3'], attr: 'p' }], name: 'n', 'piece length': 16384, pieces: singleInfo.pieces }
    const p = parseTorrent(torrentBytes(info as never).bytes)
    expect(p.files.map((f) => !!f.pad)).toEqual([false, true])
    expect(p.size).toBe(5)
  })

  it('still hashes when crypto.subtle is missing', () => {
    vi.stubGlobal('crypto', {})
    const { bytes, infoBytes } = torrentBytes(singleInfo)
    expect(parseTorrent(bytes).infohash).toBe(sha1hex(infoBytes))
  })

  it('rejects a truncated file', () => {
    const { bytes } = torrentBytes(singleInfo)
    expect(() => parseTorrent(bytes.subarray(0, bytes.length - 10))).toThrow(TorrentParseError)
  })

  it.each([
    ['text', new TextEncoder().encode('not a torrent at all')],
    ['no info', enc({ announce: 'x' })],
    ['info is not a dict', enc({ info: 5 })],
    ['no name', torrentBytes({ length: 1, 'piece length': 1, pieces: singleInfo.pieces }).bytes],
    ['empty', new Uint8Array()],
  ])('rejects %s', (_n, bytes) => {
    expect(() => parseTorrent(bytes)).toThrow(TorrentParseError)
  })
})
