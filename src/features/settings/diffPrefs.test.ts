import { describe, expect, it } from 'vitest'
import type { Preferences } from '../../api/types'
import { diffPrefs } from './diffPrefs'

const orig = { save_path: '/a', upnp: true, dl_limit: 0, max_ratio: -1 } as Preferences

describe('diffPrefs', () => {
  it('returns only the changed keys', () => {
    expect(diffPrefs(orig, { ...orig, save_path: '/b' })).toEqual({ save_path: '/b' })
    expect(diffPrefs(orig, { ...orig })).toEqual({})
  })
  it('never sends an empty password, sends a typed one', () => {
    expect(diffPrefs(orig, { ...orig, web_ui_password: '' })).toEqual({})
    expect(diffPrefs(orig, { ...orig, web_ui_password: 'secret' })).toEqual({ web_ui_password: 'secret' })
  })
})
