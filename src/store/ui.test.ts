import { beforeEach, describe, expect, it, vi } from 'vitest'

const style = { setProperty: vi.fn() }
const dataset: Record<string, string> = {}
const meta = { setAttribute: vi.fn() }
beforeEach(() => {
  vi.resetModules()
  style.setProperty.mockReset()
  delete dataset.theme
  meta.setAttribute.mockReset()
  vi.unstubAllGlobals()
  vi.stubGlobal('document', { documentElement: { style, dataset }, querySelector: () => meta })
})

describe('useUi', () => {
  it('setAccent writes localStorage and --accent', async () => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => void (store[k] = v),
    })
    const { useUi } = await import('./ui')
    useUi.getState().setAccent('#A78BFA')
    expect(useUi.getState().accent).toBe('#A78BFA')
    expect(style.setProperty).toHaveBeenCalledWith('--accent', '#A78BFA')
    expect(Object.values(store)).toContain('#A78BFA')
  })
  it('survives a throwing localStorage', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    })
    const { useUi } = await import('./ui')
    expect(() => useUi.getState().setAccent('#22D3EE')).not.toThrow()
    expect(useUi.getState().accent).toBe('#22D3EE')
  })
  it('restores a saved accent on load', async () => {
    vi.stubGlobal('localStorage', { getItem: () => '#FBBF24', setItem: () => {} })
    const { useUi } = await import('./ui')
    expect(useUi.getState().accent).toBe('#FBBF24')
    expect(style.setProperty).toHaveBeenCalledWith('--accent', '#FBBF24')
  })

  describe('theme', () => {
    const memory = (seed: Record<string, string> = {}) => {
      const store = { ...seed }
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => void (store[k] = v),
      })
      return store
    }
    const media = (dark: boolean) => {
      const listeners: (() => void)[] = []
      const q = { matches: dark, addEventListener: (_: string, f: () => void) => listeners.push(f) }
      vi.stubGlobal('window', { matchMedia: () => q })
      return { q, fire: () => listeners.forEach((f) => f()) }
    }

    it('stays dark by default', async () => {
      memory()
      media(false)
      const { useUi } = await import('./ui')
      expect(useUi.getState().theme).toBe('dark')
      expect(dataset.theme).toBe('dark')
    })

    it('ignores a garbage saved value', async () => {
      memory({ 'qbit.theme': 'neon' })
      const { useUi } = await import('./ui')
      expect(useUi.getState().theme).toBe('dark')
    })

    it('setTheme saves, applies, and updates the browser colour', async () => {
      const store = memory()
      media(true)
      const { useUi } = await import('./ui')
      useUi.getState().setTheme('light')
      expect(store['qbit.theme']).toBe('light')
      expect(dataset.theme).toBe('light')
      expect(meta.setAttribute).toHaveBeenLastCalledWith('content', '#F4F4F5')
    })

    it('system follows the OS, also while open; a fixed choice does not', async () => {
      memory({ 'qbit.theme': 'system' })
      const m = media(false)
      const { useUi } = await import('./ui')
      expect(dataset.theme).toBe('light')
      m.q.matches = true
      m.fire()
      expect(dataset.theme).toBe('dark')
      useUi.getState().setTheme('light')
      m.fire()
      expect(dataset.theme).toBe('light')
    })
  })
})
