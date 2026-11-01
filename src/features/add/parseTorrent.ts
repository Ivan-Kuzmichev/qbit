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
}

type Dict = { [key: string]: BValue }

const isDict = (v: BValue | undefined): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Uint8Array)
const isBytes = (v: BValue | undefined): v is Uint8Array => v instanceof Uint8Array
const text = (v: BValue | undefined): string | null => (isBytes(v) ? new TextDecoder('utf-8').decode(v) : null)
const num = (v: BValue | undefined): number | null => (typeof v === 'number' && v >= 0 ? v : null)

function v2Files(tree: Dict, prefix: string, out: TorrentFileEntry[]): void {
  for (const [name, node] of Object.entries(tree)) {
    if (!isDict(node)) throw new TorrentParseError('Bad file tree')
    const leaf = node['']
    if (isDict(leaf)) {
      const size = num(leaf.length)
      if (size === null) throw new TorrentParseError('Bad file length')
      out.push({ path: prefix + name, size })
    } else {
      v2Files(node, `${prefix}${name}/`, out)
    }
  }
}

export function parseTorrent(bytes: Uint8Array): ParsedTorrent {
  let root: BValue
  let spans: Record<string, [number, number]>
  try {
    ;({ value: root, spans } = decodeWithSpans(bytes))
  } catch (e) {
    if (e instanceof BencodeError) throw new TorrentParseError(e.message)
    throw e
  }
  if (!isDict(root) || !isDict(root.info) || !spans.info) throw new TorrentParseError('No info dictionary')
  const info = root.info
  const name = text(info.name)
  if (!name) throw new TorrentParseError('No name')

  const hasV1 = isBytes(info.pieces)
  const tree = isDict(info['file tree']) ? info['file tree'] : null
  const files: TorrentFileEntry[] = []

  if (Array.isArray(info.files)) {
    for (const f of info.files) {
      if (!isDict(f) || !Array.isArray(f.path)) throw new TorrentParseError('Bad file entry')
      const size = num(f.length)
      const parts = f.path.map(text)
      if (size === null || parts.length === 0 || parts.some((p) => p === null)) throw new TorrentParseError('Bad file entry')
      const pad = text(f.attr)?.includes('p')
      files.push({ path: [name, ...(parts as string[])].join('/'), size, ...(pad ? { pad: true } : {}) })
    }
  } else if (num(info.length) !== null) {
    files.push({ path: name, size: info.length as number })
  } else if (tree) {
    v2Files(tree, `${name}/`, files)
    // a v2 single-file torrent has the file directly under its own name
    if (files.length === 1 && files[0].path === `${name}/${name}`) files[0].path = name
  } else {
    throw new TorrentParseError('No files')
  }
  if (files.length === 0) throw new TorrentParseError('No files')

  const [from, to] = spans.info
  const infoBytes = bytes.subarray(from, to)
  const infohash = hasV1 ? sha1(infoBytes) : tree ? sha256(infoBytes).slice(0, 40) : ''
  if (!infohash) throw new TorrentParseError('Neither v1 nor v2 metadata')

  return { name, size: files.reduce((n, f) => (f.pad ? n : n + f.size), 0), files, infohash }
}
