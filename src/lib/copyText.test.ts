// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText } from './copyText'

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(document, 'execCommand')
})

describe('copyText', () => {
  it('uses navigator.clipboard when it exists', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    expect(await copyText('magnet:?xt=1')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('magnet:?xt=1')
  })

  it('falls back to execCommand when navigator.clipboard is undefined (plain HTTP)', async () => {
    vi.stubGlobal('navigator', { clipboard: undefined })
    let copied = ''
    const exec = vi.fn((cmd: string) => {
      copied = (document.activeElement as HTMLTextAreaElement).value
      return cmd === 'copy'
    })
    Object.defineProperty(document, 'execCommand', { configurable: true, value: exec })
    expect(await copyText('magnet:?xt=2')).toBe(true)
    expect(exec).toHaveBeenCalledWith('copy')
    expect(copied).toBe('magnet:?xt=2')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('falls back to execCommand when the clipboard write is rejected', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    Object.defineProperty(document, 'execCommand', { configurable: true, value: vi.fn(() => true) })
    expect(await copyText('x')).toBe(true)
  })

  it('reports failure when nothing can copy', async () => {
    vi.stubGlobal('navigator', { clipboard: undefined })
    Object.defineProperty(document, 'execCommand', { configurable: true, value: vi.fn(() => false) })
    expect(await copyText('x')).toBe(false)
  })
})
