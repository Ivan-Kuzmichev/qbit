import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { t } from '../../i18n/ru'
import { useRoute } from '../../lib/router'
import { loadVersions } from '../auth/versions'
import { logOut } from './logout'
import { sections } from './schema'
import { SettingRow } from './SettingRow'
import { useSettingsDraft } from './useSettingsDraft'
import styles from './SettingsPage.module.css'

function SessionCard({ confirmLeave }: { confirmLeave(action: () => void): void }) {
  const known = loadVersions()
  const version = [
    `${t.app.name} v${__APP_VERSION__}`,
    ...(known ? [`${t.app.qbittorrent} ${known.app}`, `${t.app.webApi} ${known.api}`] : []),
  ].join(' · ')

  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <h2 className={styles.cardTitle}>{t.settings.session}</h2>
        <span className={styles.cardDesc}>{t.settings.sessionDesc}</span>
      </header>
      <div className={styles.session}>
        <Button onClick={() => confirmLeave(() => void logOut())}>{t.settings.logout}</Button>
        <span className={styles.version}>{version}</span>
      </div>
    </section>
  )
}

export function SettingsPage() {
  const { path, navigate } = useRoute()
  const s = useSettingsDraft()
  const requested = path.split('/')[2]
  const section = sections.find((x) => x.id === requested) ?? sections[0]

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>{t.settings.title}</h1>
        {s.dirty && <span className={styles.dirty}>{t.settings.dirty}</span>}
        <Button size="sm" disabled={!s.dirty || s.saving} onClick={s.reset}>
          {t.settings.reset}
        </Button>
        <Button size="sm" variant="primary" disabled={!s.canSave} onClick={() => void s.save()}>
          {t.settings.save}
        </Button>
      </div>

      <div className={styles.body}>
        <nav className={styles.nav} aria-label={t.settings.sectionsLabel}>
          {sections.map((x) => (
            <button
              key={x.id}
              type="button"
              className={styles.navItem}
              aria-current={x.id === section.id ? 'page' : undefined}
              onClick={() => navigate(`/settings/${x.id}`)}
            >
              {x.title}
            </button>
          ))}
        </nav>

        <div className={styles.cards}>
          {s.status === 'loading' && <div role="status">{t.settings.loading}</div>}
          {s.status === 'error' && (
            <div role="alert" className={styles.failed}>
              {t.settings.loadFailed}
              <Button size="sm" onClick={s.load}>
                {t.settings.retry}
              </Button>
            </div>
          )}
          {s.draft &&
            section.cards.map((card) => (
              <section key={card.title} className={styles.card}>
                <header className={styles.cardHead}>
                  <h2 className={styles.cardTitle}>{card.title}</h2>
                  <span className={styles.cardDesc}>{card.desc}</span>
                </header>
                {card.rows.map((row) => (
                  <SettingRow
                    key={`${row.key}:${s.version}`}
                    row={row}
                    draft={s.draft!}
                    set={s.set}
                    setInvalid={s.setInvalid}
                  />
                ))}
              </section>
            ))}
          {s.draft && section.id === 'webui' && <SessionCard confirmLeave={s.confirmLeave} />}
        </div>
      </div>

      {s.leaving && (
        <Dialog title={t.settings.leaveTitle} onClose={s.stay} width={400}>
          <p className={styles.leaveBody}>{t.settings.leaveBody}</p>
          <div className={styles.leaveActions}>
            <Button onClick={s.stay}>{t.settings.stay}</Button>
            <Button variant="danger" onClick={s.leave}>
              {t.settings.leave}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
