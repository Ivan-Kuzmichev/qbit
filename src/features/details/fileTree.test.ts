import { describe, expect, it } from 'vitest'
import type { TorrentFile } from '../../api/types'
import { buildTree, flatten } from './fileTree'

const f = (index: number, name: string, size: number, progress = 0, priority = 1): TorrentFile => ({
  index, name, size, progress, priority, piece_range: [0, 0], availability: 1,
})

describe('buildTree', () => {
  it('nests folders from paths', () => {
    const tree = buildTree([f(0, 'a/b/c.txt', 10), f(1, 'a/d.txt', 5)])
    expect(tree).toHaveLength(1)
    const a = tree[0]
    expect(a).toMatchObject({ kind: 'folder', name: 'a', path: 'a' })
    expect(a.children?.map((n) => n.name)).toEqual(['b', 'd.txt'])
    expect(a.children?.[0].children?.[0]).toMatchObject({ kind: 'file', name: 'c.txt', path: 'a/b/c.txt' })
  })

  it('sums folder size and weights progress by size', () => {
    const [a] = buildTree([f(0, 'a/x', 10, 1), f(1, 'a/y', 30, 0)])
    expect(a.size).toBe(40)
    expect(a.progress).toBeCloseTo(0.25)
  })

  it('has zero progress for zero-size content, never NaN', () => {
    const [a] = buildTree([f(0, 'a/x', 0, 1)])
    expect(a.progress).toBe(0)
  })

  it('uses the index field as id, not the array position', () => {
    const [a] = buildTree([f(5, 'a/x', 1), f(9, 'a/y', 1)])
    expect(a.ids).toEqual([5, 9])
    expect(a.children?.map((n) => n.ids)).toEqual([[5], [9]])
  })

  it('reports mixed priority and checked state', () => {
    const [a] = buildTree([f(0, 'a/x', 1, 0, 1), f(1, 'a/y', 1, 0, 7)])
    expect(a.priority).toBe('mixed')
    expect(a.checked).toBe(true)
    const [b] = buildTree([f(0, 'b/x', 1, 0, 0), f(1, 'b/y', 1, 0, 1)])
    expect(b.checked).toBe('mixed')
    const [c] = buildTree([f(0, 'c/x', 1, 0, 0), f(1, 'c/y', 1, 0, 0)])
    expect(c.checked).toBe(false)
    expect(c.priority).toBe(0)
  })

  it('handles files without a folder', () => {
    const tree = buildTree([f(0, 'solo.bin', 3)])
    expect(tree[0]).toMatchObject({ kind: 'file', ids: [0], checked: true, priority: 1 })
  })

  it('builds 5000 files in under 50 ms', () => {
    const files = Array.from({ length: 5000 }, (_, i) => f(i, `d${i % 50}/s${i % 7}/file${i}.bin`, 100, 0.5))
    buildTree(files) // warm-up
    const t0 = performance.now()
    const tree = buildTree(files)
    expect(performance.now() - t0).toBeLessThan(50)
    expect(tree).toHaveLength(50)
  })
})

describe('flatten', () => {
  it('hides children of collapsed folders and records depth', () => {
    const tree = buildTree([f(0, 'a/b/c', 1), f(1, 'a/d', 1)])
    expect(flatten(tree, new Set()).map((r) => [r.node.name, r.depth])).toEqual([['a', 0], ['b', 1], ['c', 2], ['d', 1]])
    expect(flatten(tree, new Set(['a/b'])).map((r) => r.node.name)).toEqual(['a', 'b', 'd'])
  })
})
