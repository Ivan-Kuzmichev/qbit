const BASE = '/api/v2/'

export class ApiError extends Error {
  status: number
  constructor(status: number, message?: string) {
    super(message || `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
  }
}

export class NetworkError extends Error {
  constructor(message = 'Network error') {
    super(message)
    this.name = 'NetworkError'
  }
}

type Scalar = string | number | boolean
type ParamValue = Scalar | readonly Scalar[]
export type Params = Record<string, ParamValue>

let onForbidden: (() => void) | null = null
export function setOnForbidden(cb: (() => void) | null): void {
  onForbidden = cb
}

function toSearch(params: Params): URLSearchParams {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    sp.append(k, Array.isArray(v) ? v.join('|') : String(v))
  }
  return sp
}

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(BASE + path, { credentials: 'same-origin', ...init })
  } catch (e) {
    throw new NetworkError(e instanceof Error ? e.message : undefined)
  }
}

async function parse<T>(res: Response): Promise<T> {
  const type = res.headers.get('Content-Type') ?? ''
  if (type.includes('json')) return (await res.json()) as T
  return (await res.text()) as T
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await send(path, init)
  if (res.status === 403) onForbidden?.()
  if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ''))
  return parse<T>(res)
}

export const api = {
  get<T = unknown>(path: string, params?: Params): Promise<T> {
    const qs = params && Object.keys(params).length ? `?${toSearch(params)}` : ''
    return request<T>(path + qs, { method: 'GET' })
  },
  post<T = unknown>(path: string, form: Params | FormData): Promise<T> {
    if (form instanceof FormData) return request<T>(path, { method: 'POST', body: form })
    return request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: toSearch(form).toString(),
    })
  },
}

export async function login(username: string, password: string): Promise<'ok' | 'bad' | 'banned'> {
  const res = await send('auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: toSearch({ username, password }).toString(),
  })
  if (res.status === 403) return 'banned'
  if (res.status === 401) return 'bad'
  if (!res.ok) throw new ApiError(res.status)
  const body = (await res.text()).trim()
  return body === 'Fails.' ? 'bad' : 'ok'
}

export async function logout(): Promise<void> {
  await api.post('auth/logout', {})
}
