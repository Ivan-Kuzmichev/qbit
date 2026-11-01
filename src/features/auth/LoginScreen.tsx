import { Eye, EyeOff, CircleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { login, NetworkError } from '../../api/client'
import { Button } from '../../components/ui/Button'
import { Logo } from '../../components/ui/Logo'
import { Field } from '../../components/ui/Field'
import { IconButton } from '../../components/ui/IconButton'
import { t } from '../../i18n'
import styles from './LoginScreen.module.css'
import { loadVersions } from './versions'

export function LoginScreen({ onSuccess }: { onSuccess(): void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [shown, setShown] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const known = loadVersions()
  const footer = [
    `${t.app.name} v${__APP_VERSION__}`,
    ...(known ? [`${t.app.qbittorrent} ${known.app}`, `${t.app.webApi} ${known.api}`] : []),
  ].join(' · ')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await login(username, password)
      if (result === 'ok') {
        onSuccess()
        return
      }
      setError(result === 'bad' ? t.login.bad : t.login.banned)
    } catch (err) {
      setError(err instanceof NetworkError ? t.login.network : t.login.failed)
    }
    setBusy(false)
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} aria-label={t.login.formLabel} onSubmit={submit}>
        <div className={styles.head}>
          <div className={styles.logo}>
            <Logo />
          </div>
          <div className={styles.titles}>
            <h1 className={styles.title}>{t.login.title}</h1>
            <span className={styles.host}>{location.host}</span>
          </div>
        </div>

        <div className={styles.fields}>
          <Field
            label={t.login.username}
            height={40}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <Field
            label={t.login.password}
            height={40}
            type={shown ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            trailing={
              <IconButton
                aria-label={shown ? t.login.hidePassword : t.login.showPassword}
                onClick={() => setShown((s) => !s)}
              >
                {shown ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </IconButton>
            }
          />
        </div>

        {error && (
          <div role="alert" className={styles.error}>
            <CircleAlert size={15} aria-hidden="true" className={styles.errorIcon} />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" variant="primary" size="lg" disabled={busy}>
          {t.login.submit}
        </Button>
      </form>
      <span className={styles.footer}>{footer}</span>
    </div>
  )
}
