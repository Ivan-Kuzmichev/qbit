import { logout, signalSessionEnded } from '../../api/client'
import { toast } from '../../components/ui/Toast'
import { t } from '../../i18n/ru'

/** Ends the session; a failure becomes a toast and the user stays signed in. */
export async function logOut(): Promise<void> {
  try {
    await logout()
    signalSessionEnded()
  } catch {
    toast(t.settings.logoutFailed)
  }
}
