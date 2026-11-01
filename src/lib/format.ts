import { t } from '../i18n/ru'

function digits(v: number): string {
  if (v < 10) {
    const s = v.toFixed(2)
    return Number(s) >= 10 ? v.toFixed(1) : s
  }
  if (v < 100) {
    const s = v.toFixed(1)
    return Number(s) >= 100 ? v.toFixed(0) : s
  }
  return v.toFixed(0)
}

export function formatBytes(n: number): string {
  const units = t.units.bytes
  if (!Number.isFinite(n) || n <= 0) return `0 ${units[0]}`
  if (n < 1024) return `${Math.round(n)} ${units[0]}`
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  // rounding must not produce "1024 КБ"
  if (Number(digits(v)) >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${digits(v)} ${units[i]}`
}

export function formatSpeed(n: number): string {
  return `${formatBytes(n)}${t.units.perSecond}`
}

export function formatEta(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0 || sec >= 8640000) return t.eta.infinite
  if (sec < 60) return t.eta.lessThanMinute
  if (sec < 3600) return `${Math.floor(sec / 60)} ${t.eta.minutes}`
  if (sec < 86400) {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    return m ? `${h} ${t.eta.hours} ${m} ${t.eta.minutes}` : `${h} ${t.eta.hours}`
  }
  return `${Math.floor(sec / 86400)} ${t.eta.days}`
}

export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(Math.trunc(n))
  const m100 = abs % 100
  const m10 = abs % 10
  let form = forms[2]
  if (m100 < 11 || m100 > 14) {
    if (m10 === 1) form = forms[0]
    else if (m10 >= 2 && m10 <= 4) form = forms[1]
  }
  return `${n} ${form}`
}
