import type { Preferences } from '../../api/types'

/** The keys of `draft` that differ from `orig`. An empty password means "unchanged" and is never sent. */
export function diffPrefs(orig: Preferences, draft: Preferences): Partial<Preferences> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(draft) as (keyof Preferences)[]) {
    const value = draft[key]
    if (key === 'web_ui_password' && !value) continue
    if (orig[key] !== value) out[key] = value
  }
  return out as Partial<Preferences>
}
