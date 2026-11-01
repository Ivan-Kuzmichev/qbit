import { t } from '../../i18n'

const TOKEN = /^\d+:[A-Za-z0-9_-]{20,}$/
const CHAT = /^(-?\d+|@[A-Za-z0-9_]{5,})$/
const OURS = /^curl -s --max-time 30 -X POST https:\/\/api\.telegram\.org\/bot(\S+)\/sendMessage -d chat_id=(\S+) --data-urlencode "/

export const isTelegramToken = (s: string) => TOKEN.test(s)
export const isTelegramChat = (s: string) => CHAT.test(s)

/**
 * The command qBittorrent runs when a torrent finishes. On Linux it splits the command first and substitutes %N
 * into each argument without a shell, so a hostile torrent name can't add arguments. Token and chat are validated
 * to contain neither spaces nor quotes before they get here.
 */
export function buildTelegramCommand(token: string, chat: string): string {
  return `curl -s --max-time 30 -X POST https://api.telegram.org/bot${token}/sendMessage -d chat_id=${chat} --data-urlencode "text=${t.settings.telegram.message}"`
}

export function parseTelegramCommand(command: string): { token: string; chat: string } | null {
  const m = OURS.exec(command)
  return m ? { token: m[1], chat: m[2] } : null
}
