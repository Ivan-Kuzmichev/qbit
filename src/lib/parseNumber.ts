/** Limit in MB (accepts "1,5" and "1.5"; empty or "∞" = no limit) -> bytes/s; null if invalid. */
export function parseLimitMb(input: string): number | null {
  const s = input.trim().replace(',', '.')
  if (s === '' || s === '∞') return 0
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const mb = Number(s)
  if (!Number.isFinite(mb)) return null
  return Math.round(mb * 1024 * 1024)
}
