import { beforeEach, describe, expect, it } from 'vitest'
import { useDialogs } from './dialogs'

beforeEach(() => useDialogs.getState().close())

describe('useDialogs', () => {
  it('opens one dialog at a time and closes it', () => {
    useDialogs.getState().openDelete(['a'])
    expect(useDialogs.getState().open).toEqual({ kind: 'delete', hashes: ['a'] })
    useDialogs.getState().openMove(['b'])
    expect(useDialogs.getState().open).toEqual({ kind: 'move', hashes: ['b'] })
    useDialogs.getState().close()
    expect(useDialogs.getState().open).toBeNull()
  })

  it('keeps the arguments of limits and add for the later dialogs', () => {
    const file = new File(['x'], 'a.torrent')
    useDialogs.getState().openAdd('file', [file])
    expect(useDialogs.getState().open).toEqual({ kind: 'add', tab: 'file', files: [file] })
    useDialogs.getState().openAdd('magnet')
    expect(useDialogs.getState().open).toEqual({ kind: 'add', tab: 'magnet', files: [] })
    useDialogs.getState().openLimits('torrent', ['a'])
    expect(useDialogs.getState().open).toEqual({ kind: 'limits', tab: 'torrent', hashes: ['a'] })
  })
})
