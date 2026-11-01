import { describe, expect, it } from 'vitest'
import { buildTelegramCommand, isTelegramChat, isTelegramToken, parseTelegramCommand } from './telegram'

const TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'

describe('telegram command', () => {
  it('reads back what it builds', () => {
    expect(parseTelegramCommand(buildTelegramCommand(TOKEN, '-1001'))).toEqual({ token: TOKEN, chat: '-1001' })
  })

  it('passes the torrent name to curl as one quoted argument', () => {
    expect(buildTelegramCommand(TOKEN, '42')).toContain('--data-urlencode "text=Скачано: %N"')
  })

  it("doesn't take someone else's command for its own", () => {
    expect(parseTelegramCommand('')).toBeNull()
    expect(parseTelegramCommand('/config/notify.sh "%N"')).toBeNull()
  })

  it.each([TOKEN])('accepts token %s', (s) => expect(isTelegramToken(s)).toBe(true))
  it.each(['', '123', 'abc:def', `${TOKEN} -o x`, `${TOKEN}"`, `${TOKEN}/x`])('rejects token %j', (s) =>
    expect(isTelegramToken(s)).toBe(false),
  )
  it.each(['42', '-1001234', '@my_channel'])('accepts chat %s', (s) => expect(isTelegramChat(s)).toBe(true))
  it.each(['', 'abc', '42 -o x', '@a', '42"'])('rejects chat %j', (s) => expect(isTelegramChat(s)).toBe(false))
})
