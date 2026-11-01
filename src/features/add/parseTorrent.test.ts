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

  it('hybrid: infohash is SHA-1, ids carry both candidates (qBittorrent may use the v2 one)', () => {
    const hybrid = { ...singleInfo, 'file tree': v2Info['file tree'], 'meta version': 2 }
    const { bytes, infoBytes } = torrentBytes(hybrid)
    const p = parseTorrent(bytes)
    expect(p.infohash).toBe(sha1hex(infoBytes))
    expect(p.ids).toEqual([sha1hex(infoBytes), sha256hex(infoBytes).slice(0, 40)])
  })

  it('ids: one for v1, one for v2-only', () => {
    const v1 = torrentBytes(singleInfo)
    expect(parseTorrent(v1.bytes).ids).toEqual([sha1hex(v1.infoBytes)])
    const v2 = torrentBytes(v2Info)
    expect(parseTorrent(v2.bytes).ids).toEqual([sha256hex(v2.infoBytes).slice(0, 40)])
  })

  it('v2 file names are UTF-8 and a single Cyrillic file collapses to its name', () => {
    const one = { 'file tree': { 'Фильм.mkv': { '': { length: 5 } } }, 'meta version': 2, name: 'Фильм.mkv', 'piece length': 16384 }
    expect(parseTorrent(torrentBytes(one).bytes).files).toEqual([{ path: 'Фильм.mkv', size: 5 }])
    const many = { 'file tree': { 'Папка': { 'Файл.txt': { '': { length: 1 } } } }, 'meta version': 2, name: 'Раздача', 'piece length': 16384 }
    expect(parseTorrent(torrentBytes(many).bytes).files[0].path).toBe('Раздача/Папка/Файл.txt')
  })

  it('v2 files keep byte order, including integer-like names and __proto__', () => {
    const leaf = (n: number) => ({ '': { length: n } })
    const tree = new Map<string, unknown>([['10', leaf(1)], ['9', leaf(2)], ['__proto__', leaf(3)]])
    const info = { 'file tree': tree, 'meta version': 2, name: 'd', 'piece length': 16384 }
    expect(parseTorrent(torrentBytes(info as never).bytes).files.map((f) => f.path)).toEqual(['d/10', 'd/9', 'd/__proto__'])
  })

  it('recognises libtorrent padding names without attr', () => {
    const info = { files: [{ length: 5, path: ['a'] }, { length: 3, path: ['.pad', '_____padding_file_0_'] }], name: 'n', 'piece length': 16384, pieces: singleInfo.pieces }
    expect(parseTorrent(torrentBytes(info as never).bytes).files.map((f) => !!f.pad)).toEqual([false, true])
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
