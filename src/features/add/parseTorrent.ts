import { BencodeError, decodeWithSpans, type BValue } from './bencode'
import { sha1, sha256 } from './hash'

export class TorrentParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TorrentParseError'
  }
}

export interface TorrentFileEntry {
  /** Path inside the save folder, i.e. including the torrent name for multi-file torrents. */
  path: string
  size: number
  /** BEP 47 padding file: counted for indices, never shown. */
  pad?: boolean
}

export interface ParsedTorrent {
  name: string
  size: number
  files: TorrentFileEntry[]
  /** Lowercase hex, 40 chars: SHA-1 of `info` (v1 and hybrid) or the first 40 chars of its SHA-256 (v2-only). */
  infohash: string
  /**
   * Every id qBittorrent may use for this torrent. A hybrid is stored under its v2 hash
   * (libtorrent's best hash), so both the SHA-1 and the truncated SHA-256 are candidates.
   */
  ids: string[]
}

type Dict = Map<string, BValue>

const isDict = (v: BValue | undefined): v is Dict => v instanceof Map
const isBytes = (v: BValue | undefined): v is Uint8Array => v instanceof Uint8Array
const text = (v: BValue | undefined): string | null => (isBytes(v) ? new TextDecoder('utf-8').decode(v) : null)
const num = (v: BValue | undefined): number | null => (typeof v === 'number' && v >= 0 ? v : null)

function v2Files(tree: Dict, prefix: string, out: TorrentFileEntry[]): void {
  for (const [name, node] of tree) {
    if (!isDict(node)) throw new TorrentParseError('Bad file tree')
    const leaf = node.get('')
    if (isDict(leaf)) {
      const size = num(leaf.get('length'))
      if (size === null) throw new TorrentParseError('Bad file length')
      out.push({ path: prefix + name, size })
    } else {
      v2Files(node, `${prefix}${name}/`, out)
    }
  }
}

export function parseTorrent(bytes: Uint8Array): ParsedTorrent {
  let root: BValue
  let spans: Map<string, [number, number]>
  try {
    ;({ value: root, spans } = decodeWithSpans(bytes))
  } catch (e) {
    if (e instanceof BencodeError) throw new TorrentParseError(e.message)
    throw e
  }
  const info = isDict(root) ? root.get('info') : undefined
  if (!isDict(info) || !spans.has('info')) throw new TorrentParseError('No info dictionary')
  const name = text(info.get('name'))
  if (!name) throw new TorrentParseError('No name')

  const hasV1 = isBytes(info.get('pieces'))
  const treeNode = info.get('file tree')
  const tree = isDict(treeNode) ? treeNode : null
  const files: TorrentFileEntry[] = []
  const list = info.get('files')

  if (Array.isArray(list)) {
    for (const f of list) {
      const rawPath = isDict(f) ? f.get('path') : undefined
      if (!isDict(f) || !Array.isArray(rawPath)) throw new TorrentParseError('Bad file entry')
      const size = num(f.get('length'))
      const parts = rawPath.map(text)
      if (size === null || parts.length === 0 || parts.some((p) => p === null)) throw new TorrentParseError('Bad file entry')
      const path = [name, ...(parts as string[])].join('/')
      // libtorrent flags padding by attr 'p' or by its reserved file name
      const pad = text(f.get('attr'))?.includes('p') || path.includes('_____padding_file_')
      files.push({ path, size, ...(pad ? { pad: true } : {}) })
    }
  } else if (num(info.get('length')) !== null) {
    files.push({ path: name, size: info.get('length') as number })
  } else if (tree) {
    v2Files(tree, `${name}/`, files)
    // a v2 single-file torrent has the file directly under its own name
    if (files.length === 1 && files[0].path === `${name}/${name}`) files[0].path = name
  } else {
    throw new TorrentParseError('No files')
  }
  if (files.length === 0) throw new TorrentParseError('No files')

  const [from, to] = spans.get('info')!
  const infoBytes = bytes.subarray(from, to)
  const v1 = hasV1 ? sha1(infoBytes) : ''
  const v2 = tree ? sha256(infoBytes).slice(0, 40) : ''
  const infohash = v1 || v2
  if (!infohash) throw new TorrentParseError('Neither v1 nor v2 metadata')
  const ids = [v1, v2].filter(Boolean)

  return { name, size: files.reduce((n, f) => (f.pad ? n : n + f.size), 0), files, infohash, ids }
}
