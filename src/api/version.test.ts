import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getApiVersion, getAppVersion, isApiSupported } from './version'

describe('isApiSupported', () => {
  it('compares numbers, not strings', () => {
    expect(isApiSupported('2.9.3')).toBe(false)
    expect(isApiSupported('2.11.0')).toBe(true)
    expect(isApiSupported('2.11.2')).toBe(true)
    expect(isApiSupported('3.0.0')).toBe(true)
    expect(isApiSupported('2.10.9')).toBe(false)
    expect(isApiSupported('2.11')).toBe(true)
    expect(isApiSupported('garbage')).toBe(false)
  })
})

describe('version requests', () => {
  const fetchMock = vi.fn()
  beforeEach(() => vi.stubGlobal('fetch', fetchMock))
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })
  it('reads app and API versions as text', async () => {
    fetchMock.mockResolvedValueOnce(new Response('v5.0.1'))
    fetchMock.mockResolvedValueOnce(new Response('2.11.2'))
    expect(await getAppVersion()).toBe('v5.0.1')
    expect(await getApiVersion()).toBe('2.11.2')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v2/app/version')
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v2/app/webapiVersion')
  })
})
