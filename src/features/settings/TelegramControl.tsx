import { useEffect, useState } from 'react'
import type { Preferences } from '../../api/types'
import { Toggle } from '../../components/ui/Toggle'
import { t } from '../../i18n/ru'
import styles from './SettingRow.module.css'
import { buildTelegramCommand, isTelegramChat, isTelegramToken, parseTelegramCommand } from './telegram'

const s = t.settings.telegram
const INVALID_KEY = 'telegram'

interface Props {
  draft: Preferences
  set<K extends keyof Preferences>(key: K, value: Preferences[K]): void
  setInvalid(key: string, bad: boolean): void
}

export function TelegramControl({ draft, set, setInvalid }: Props) {
  // Read once: the draft's command changes as these fields are typed into.
  const [saved] = useState(() => draft.autorun_program ?? '')
  const [savedEnabled] = useState(() => draft.autorun_enabled)
  const parsed = parseTelegramCommand(saved)
  const foreign = saved.trim() !== '' && !parsed
  const [on, setOn] = useState(Boolean(parsed && draft.autorun_enabled))
  const [token, setToken] = useState(parsed?.token ?? '')
  const [chat, setChat] = useState(parsed?.chat ?? '')

  const tokenBad = on && !isTelegramToken(token)
  const chatBad = on && !isTelegramChat(chat)
  const bad = tokenBad || chatBad

  useEffect(() => {
    setInvalid(INVALID_KEY, bad)
    return () => setInvalid(INVALID_KEY, false)
  }, [bad, setInvalid])

  const apply = (nextOn: boolean, nextToken: string, nextChat: string) => {
    if (nextOn && isTelegramToken(nextToken) && isTelegramChat(nextChat)) {
      set('autorun_enabled', true)
      set('autorun_program', buildTelegramCommand(nextToken, nextChat))
    } else if (!nextOn) {
      // Someone else's command comes back untouched; ours stays stored so the fields survive switching off.
      set('autorun_enabled', foreign ? savedEnabled : false)
      if (foreign) set('autorun_program', saved)
    }
  }

  return (
    <div className={styles.stack}>
      <div className={styles.stackRow}>
        <span className={styles.label}>{s.enable}</span>
        <Toggle
          aria-label={s.enable}
          checked={on}
          onChange={(v) => {
            setOn(v)
            apply(v, token, chat)
          }}
        />
      </div>
      {foreign && (
        <p className={styles.hint}>
          {s.foreign} <code className={styles.command}>{saved}</code>
        </p>
      )}
      {on && (
        <>
          <div className={styles.stackField}>
            <span className={styles.label}>{s.token}</span>
            <span className={`${styles.frame} ${styles.full}`} data-invalid={token && tokenBad ? '' : undefined}>
              <input
                className={`${styles.input} ${styles.mono}`}
                aria-label={s.token}
                type="password"
                autoComplete="new-password"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value.trim())
                  apply(on, e.target.value.trim(), chat)
                }}
              />
            </span>
            <span className={styles.hint} role={token && tokenBad ? 'alert' : undefined}>
              {token && tokenBad ? s.tokenInvalid : s.tokenHint}
            </span>
          </div>
          <div className={styles.stackField}>
            <span className={styles.label}>{s.chat}</span>
            <span className={`${styles.frame} ${styles.full}`} data-invalid={chat && chatBad ? '' : undefined}>
              <input
                className={`${styles.input} ${styles.mono}`}
                aria-label={s.chat}
                autoComplete="off"
                value={chat}
                onChange={(e) => {
                  setChat(e.target.value.trim())
                  apply(on, token, e.target.value.trim())
                }}
              />
            </span>
            <span className={styles.hint} role={chat && chatBad ? 'alert' : undefined}>
              {chat && chatBad ? s.chatInvalid : s.chatHint}
            </span>
          </div>
          <p className={styles.hint}>{s.note}</p>
        </>
      )}
    </div>
  )
}
