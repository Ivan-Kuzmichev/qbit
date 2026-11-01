import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import type { Preferences } from '../../api/types'
import { toast } from '../../components/ui/Toast'
import { t } from '../../i18n'
import { reloadPage, setNavigationGuard } from '../../lib/router'
import { diffPrefs } from './diffPrefs'
import { sections } from './schema'

export type SettingsStatus = 'loading' | 'error' | 'ready'

const SCHEDULE_KEYS = ['schedule_from_hour', 'schedule_from_min', 'schedule_to_hour', 'schedule_to_min'] as const satisfies readonly (keyof Preferences)[]

const IN_SETTINGS = /^\/settings(\/|$)/

/** Long enough for the save toast to be read and the unsaved-changes prompt to be removed. */
const RELOAD_DELAY_MS = 800

const ROWS = sections.flatMap((s) => s.cards.flatMap((c) => c.rows))

/** Keys that only make sense while their switch is on: changes to them are not sent when it is off. */
const DEPENDENT = ROWS.filter((r) => r.enabledBy).map((r) => [r.key as keyof Preferences, r.enabledBy!] as const)

/** Rows hidden by `visibleIf` alone; the schedule row stands for all four time keys. */
const HIDEABLE = ROWS.filter((r) => r.visibleIf && !r.enabledBy).map((r) => ({
  keys: r.kind === 'schedule' ? SCHEDULE_KEYS : [r.key as keyof Preferences],
  visible: r.visibleIf!,
}))

function effectiveDiff(orig: Preferences, draft: Preferences): Partial<Preferences> {
  const diff = diffPrefs(orig, draft)
  for (const [key, switchKey] of DEPENDENT) if (!draft[switchKey]) delete diff[key]
  for (const { keys, visible } of HIDEABLE) if (!visible(draft)) for (const key of keys) delete diff[key]
  return diff
}

export function useSettingsDraft() {
  const [orig, setOrig] = useState<Preferences | null>(null)
  const [draft, setDraft] = useState<Preferences | null>(null)
  const [status, setStatus] = useState<SettingsStatus>('loading')
  const [saving, setSaving] = useState(false)
  const [invalid, setInvalidKeys] = useState<ReadonlySet<string>>(new Set())
  /** Bumped on reset and save so inputs holding their own text start over from the draft. */
  const [version, setVersion] = useState(0)
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)

  const fetchPrefs = useCallback(() => {
    api
      .get<Preferences>('app/preferences')
      .then((p) => {
        setOrig(p)
        setDraft(p)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => {
    fetchPrefs()
  }, [fetchPrefs])

  const load = useCallback(() => {
    setStatus('loading')
    fetchPrefs()
  }, [fetchPrefs])

  const set = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d))
  }, [])

  const setInvalid = useCallback((key: string, bad: boolean) => {
    setInvalidKeys((prev) => {
      if (prev.has(key) === bad) return prev
      const next = new Set(prev)
      if (bad) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  const dirty = useMemo(() => (orig && draft ? Object.keys(diffPrefs(orig, draft)).length > 0 : false), [orig, draft])
  const canSave = dirty && invalid.size === 0 && !saving

  const reset = useCallback(() => {
    setDraft(orig)
    setInvalidKeys(new Set())
    setVersion((v) => v + 1)
  }, [orig])

  const save = useCallback(async () => {
    if (!orig || !draft || !canSave) return
    const diff = effectiveDiff(orig, draft)
    setSaving(true)
    try {
      if (Object.keys(diff).length > 0) await api.post('app/setPreferences', { json: JSON.stringify(diff) })
    } catch {
      toast(t.settings.saveFailed)
      setSaving(false)
      return
    }
    const next = { ...orig, ...diff }
    delete next.web_ui_password
    setOrig(next)
    setDraft(next)
    setVersion((v) => v + 1)
    setSaving(false)
    toast(t.settings.saved)
    // qBittorrent now serves its own UI: this page would otherwise stay until the next manual reload.
    if (diff.alternative_webui_enabled === false) setTimeout(reloadPage, RELOAD_DELAY_MS)
  }, [orig, draft, canSave])

  // Leaving the settings area with unsaved changes: ask first (in-app) or let the browser ask (tab close).
  useEffect(() => {
    if (!dirty) return
    setNavigationGuard((to, proceed) => {
      if (IN_SETTINGS.test(to)) return true
      setPendingLeave(() => proceed)
      return false
    })
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      setNavigationGuard(null)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [dirty])

  /** Runs `action` now, or after the user confirms losing unsaved changes. */
  const confirmLeave = useCallback(
    (action: () => void) => {
      if (dirty) setPendingLeave(() => action)
      else action()
    },
    [dirty],
  )

  const stay = useCallback(() => setPendingLeave(null), [])
  const leave = useCallback(() => {
    const proceed = pendingLeave
    setPendingLeave(null)
    proceed?.()
  }, [pendingLeave])

  return {
    status,
    load,
    draft,
    set,
    setInvalid,
    dirty,
    canSave,
    saving,
    save,
    reset,
    version,
    leaving: pendingLeave !== null,
    stay,
    leave,
    confirmLeave,
  }
}
