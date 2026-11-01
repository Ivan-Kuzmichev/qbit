import type { TorrentFile } from '../../api/types'

export interface TreeNode {
  kind: 'file' | 'folder'
  name: string
  /** Full path inside the torrent; unique, so it keys rows and the collapsed set. */
  path: string
  size: number
  /** 0..1, weighted by size for folders. */
  progress: number
  checked: boolean | 'mixed'
  priority: number | 'mixed'
  /** File indices (the `index` field of torrents/files) under this node. */
  ids: number[]
  children?: TreeNode[]
}

export interface FlatRow {
  node: TreeNode
  depth: number
}

interface Acc extends TreeNode {
  done: number
  min: number
  max: number
}

const finish = (n: Acc): void => {
  n.progress = n.size > 0 ? n.done / n.size : 0
  n.priority = n.min === n.max ? n.min : 'mixed'
  n.checked = n.max === 0 ? false : n.min === 0 ? 'mixed' : true
}

/** Builds the folder tree in one pass: each file adds itself to every ancestor on its path. */
export function buildTree(files: readonly TorrentFile[]): TreeNode[] {
  const roots: Acc[] = []
  const folders = new Map<string, Acc>()
  const all: Acc[] = []
  const make = (kind: Acc['kind'], name: string, path: string): Acc => {
    const n: Acc = {
      kind, name, path, size: 0, progress: 0, checked: true, priority: 1, ids: [],
      done: 0, min: Infinity, max: -Infinity,
      ...(kind === 'folder' ? { children: [] } : {}),
    }
    all.push(n)
    return n
  }

  for (const file of files) {
    const parts = file.name.split('/')
    const size = Number.isFinite(file.size) ? file.size : 0
    const progress = Number.isFinite(file.progress) ? Math.min(1, Math.max(0, file.progress)) : 0
    const leaf = make('file', parts[parts.length - 1], file.name)
    const chain: Acc[] = [leaf]
    let siblings = roots
    let path = ''
    for (let i = 0; i < parts.length - 1; i++) {
      path = path ? `${path}/${parts[i]}` : parts[i]
      let folder = folders.get(path)
      if (!folder) {
        folder = make('folder', parts[i], path)
        folders.set(path, folder)
        siblings.push(folder)
      }
      chain.push(folder)
      siblings = folder.children as Acc[]
    }
    siblings.push(leaf)
    for (const n of chain) {
      n.size += size
      n.done += size * progress
      n.ids.push(file.index)
      n.min = Math.min(n.min, file.priority)
      n.max = Math.max(n.max, file.priority)
    }
  }
  all.forEach(finish)
  return roots
}

/** Depth-first rows of the visible part of the tree. */
export function flatten(nodes: readonly TreeNode[], collapsed: ReadonlySet<string>): FlatRow[] {
  const rows: FlatRow[] = []
  const walk = (list: readonly TreeNode[], depth: number) => {
    for (const node of list) {
      rows.push({ node, depth })
      if (node.children && !collapsed.has(node.path)) walk(node.children, depth + 1)
    }
  }
  walk(nodes, 0)
  return rows
}
