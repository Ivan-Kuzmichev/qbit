import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The test setup pins the language; here the real module runs.
vi.unmock('./lang')

const memory = (seed: Record<string, string> = {}) => {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => seed[k] ?? null,
    setItem: (k: string, v: string) => void (seed[k] = v),
  })
  return seed
}

beforeEach(() => vi.resetModules())
afterEach(() => vi.unstubAllGlobals())

describe('lang', () => {
  it('is English by default, whatever the browser says', async () => {
    memory()
    vi.stubGlobal('navigator', { language: 'ru-RU' })
    expect((await import('./lang')).lang).toBe('en')
  })

  it('reads a saved language and ignores garbage', async () => {
    memory({ 'qbit.lang': 'ru' })
    expect((await import('./lang')).lang).toBe('ru')
    vi.resetModules()
    memory({ 'qbit.lang': 'tlh' })
    expect((await import('./lang')).lang).toBe('en')
  })

  it('setLang saves and reloads', async () => {
    const store = memory()
    const reload = vi.fn()
    vi.stubGlobal('window', { location: { reload } })
    ;(await import('./lang')).setLang('ru')
    expect(store['qbit.lang']).toBe('ru')
    expect(reload).toHaveBeenCalledOnce()
  })

  it('survives a throwing localStorage', async () => {
    const reload = vi.fn()
    vi.stubGlobal('window', { location: { reload } })
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    const m = await import('./lang')
    expect(m.lang).toBe('en')
    m.setLang('ru')
    expect(reload).not.toHaveBeenCalled()
  })
})
