import { beforeEach, describe, expect, it, vi } from 'vitest'

const style = { setProperty: vi.fn() }
beforeEach(() => {
  vi.resetModules()
  style.setProperty.mockReset()
  vi.stubGlobal('document', { documentElement: { style } })
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
})
