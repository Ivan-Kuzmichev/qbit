import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, login, logout, NetworkError, setOnForbidden } from './client'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  setOnForbidden(null)
})

const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })

describe('login', () => {
  it('200 Ok. -> ok', async () => {
    fetchMock.mockResolvedValue(text('Ok.'))
    expect(await login('admin', 'pw')).toBe('ok')
  })
  it('204 with empty body -> ok', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    expect(await login('admin', 'pw')).toBe('ok')
  })
  it('200 Fails. -> bad', async () => {
    fetchMock.mockResolvedValue(text('Fails.'))
    expect(await login('admin', 'pw')).toBe('bad')
  })
  it('401 -> bad', async () => {
    fetchMock.mockResolvedValue(text('', 401))
    expect(await login('admin', 'pw')).toBe('bad')
  })
  it('403 -> banned and onForbidden is not called', async () => {
    const cb = vi.fn()
    setOnForbidden(cb)
    fetchMock.mockResolvedValue(text('Forbidden', 403))
    expect(await login('admin', 'pw')).toBe('banned')
    expect(cb).not.toHaveBeenCalled()
  })
  it('sends urlencoded body to /api/v2/auth/login', async () => {
    fetchMock.mockResolvedValue(text('Ok.'))
    await login('ad min', 'p&w=')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v2/auth/login')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(init.body).toBe('username=ad+min&password=p%26w%3D')
  })
  it('fetch rejection -> NetworkError', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(login('a', 'b')).rejects.toBeInstanceOf(NetworkError)
  })
})

describe('logout', () => {
  it('posts to auth/logout', async () => {
    fetchMock.mockResolvedValue(text(''))
    await logout()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v2/auth/logout')
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
  })
})

describe('api', () => {
  it('get parses JSON by Content-Type and builds query', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"a":1}', { headers: { 'Content-Type': 'application/json; charset=UTF-8' } }),
    )
    const r = await api.get<{ a: number }>('sync/maindata', { rid: 5 })
    expect(r).toEqual({ a: 1 })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v2/sync/maindata?rid=5')
  })
  it('get returns text otherwise', async () => {
    fetchMock.mockResolvedValue(text('v5.0.0'))
    expect(await api.get<string>('app/version')).toBe('v5.0.0')
  })
  it('403 on get calls onForbidden and throws ApiError', async () => {
    const cb = vi.fn()
    setOnForbidden(cb)
    fetchMock.mockResolvedValue(text('Forbidden', 403))
    const err = (await api.get('app/version').catch((e: unknown) => e)) as ApiError
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(403)
    expect(cb).toHaveBeenCalledTimes(1)
  })
  it('non-2xx throws ApiError with status', async () => {
    fetchMock.mockResolvedValue(text('nope', 404))
    await expect(api.get('x')).rejects.toMatchObject({ status: 404 })
  })
  it('fetch rejection -> NetworkError', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed'))
    await expect(api.get('x')).rejects.toBeInstanceOf(NetworkError)
  })
  it('post form is urlencoded; hash arrays are joined by |', async () => {
    fetchMock.mockResolvedValue(text(''))
    await api.post('torrents/stop', { hashes: ['a', 'b'], deleteFiles: true, n: 0 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v2/torrents/stop')
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(new URLSearchParams(init.body).get('hashes')).toBe('a|b')
    expect(new URLSearchParams(init.body).get('deleteFiles')).toBe('true')
    expect(new URLSearchParams(init.body).get('n')).toBe('0')
  })
  it('get params with array use a|b', async () => {
    fetchMock.mockResolvedValue(text(''))
    await api.get('torrents/info', { hashes: ['a', 'b'] })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v2/torrents/info?hashes=a%7Cb')
  })
  it('post FormData is passed through without Content-Type', async () => {
    fetchMock.mockResolvedValue(text(''))
    const fd = new FormData()
    fd.append('urls', 'magnet:?xt=1')
    await api.post('torrents/add', fd)
    const init = fetchMock.mock.calls[0][1]
    expect(init.body).toBe(fd)
    expect(init.headers?.['Content-Type']).toBeUndefined()
  })
})
