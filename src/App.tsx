import { useEffect, useState } from 'react'
import { ApiError, setOnForbidden } from './api/client'
import { getApiVersion, getAppVersion, isApiSupported } from './api/version'
import { ToastHost } from './components/ui/Toast'
import { LoginScreen } from './features/auth/LoginScreen'
import { UpgradeScreen } from './features/auth/UpgradeScreen'
import { saveVersions } from './features/auth/versions'
import { ConnectionBanner } from './features/shell/ConnectionBanner'
import { DesktopLayout } from './features/shell/DesktopLayout'
import { DetailsCard } from './features/details/DetailsCard'
import { DropOverlay } from './features/add/DropOverlay'
import { DialogHost } from './features/torrents/DialogHost'
import { TopBar } from './features/torrents/TopBar'
import { TorrentTable } from './features/torrents/TorrentTable'
import { t } from './i18n/ru'
import { useIsMobile } from './lib/useIsMobile'
import { emptySync } from './store/mergeMainData'
import { useTorrents } from './store/torrents'

const RETRY_MS = 3000

type Phase =
  | { name: 'boot' }
  | { name: 'offline' }
  | { name: 'login' }
  | { name: 'unsupported'; app: string; api: string }
  | { name: 'ready' }

/** Decides what to show at startup; has no side effects on the UI. */
async function bootstrap(): Promise<Phase> {
  try {
    const app = await getAppVersion()
    const api = await getApiVersion()
    if (!isApiSupported(api)) return { name: 'unsupported', app, api }
    saveVersions({ app, api })
    return { name: 'ready' }
  } catch (e) {
    // 403 means "no session"; any other failure is treated as a server that is not reachable yet
    return e instanceof ApiError && e.status === 403 ? { name: 'login' } : { name: 'offline' }
  }
}

export function App() {
  const isMobile = useIsMobile()
  const [phase, setPhase] = useState<Phase>({ name: 'boot' })
  /** Bumped to run the startup check again (retry, or after a successful login). */
  const [round, setRound] = useState(0)

  useEffect(() => {
    let alive = true
    void bootstrap().then((next) => {
      if (!alive) return
      if (next.name === 'ready') useTorrents.getState().startSync()
      setPhase(next)
    })
    return () => {
      alive = false
    }
  }, [round])

  useEffect(() => {
    setOnForbidden(() => {
      useTorrents.getState().stopSync()
      useTorrents.setState({ ...emptySync, speedHistory: [], connection: 'ok' })
      useTorrents.getState().clearSelection()
      setPhase({ name: 'login' })
    })
    return () => {
      setOnForbidden(null)
      useTorrents.getState().stopSync()
    }
  }, [])

  useEffect(() => {
    if (phase.name !== 'offline') return
    const timer = setTimeout(() => setRound((r) => r + 1), RETRY_MS)
    return () => clearTimeout(timer)
  }, [phase])

  let view
  switch (phase.name) {
    case 'login':
      view = <LoginScreen onSuccess={() => {
          setPhase({ name: 'boot' })
          setRound((r) => r + 1)
        }} />
      break
    case 'unsupported':
      view = <UpgradeScreen appVersion={phase.app} apiVersion={phase.api} />
      break
    case 'offline':
      view = <div role="status">{t.connection.lost}</div>
      break
    case 'ready':
      view = (
        <>
          <ConnectionBanner />
          <DialogHost />
          <DropOverlay />
          {isMobile ? (
            <main>{t.app.name}</main>
          ) : (
            <DesktopLayout>
              <TopBar />
              <TorrentTable />
              <DetailsCard />
            </DesktopLayout>
          )}
        </>
      )
      break
    default:
      view = null
  }

  return (
    <>
      {view}
      <ToastHost />
    </>
  )
}
