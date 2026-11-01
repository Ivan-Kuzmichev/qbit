/** Limit in MB (accepts "1,5" and "1.5"; empty or "∞" = no limit) -> bytes/s; null if invalid. */
export function parseLimitMb(input: string): number | null {
  const s = input.trim().replace(',', '.')
  if (s === '' || s === '∞') return 0
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const mb = Number(s)
  if (!Number.isFinite(mb)) return null
  return Math.round(mb * 1024 * 1024)
}

/** Limit in KB/s (accepts "512" and "0,5"; empty or "∞" = no limit) -> bytes/s; null if invalid. */
export function parseLimitKb(input: string): number | null {
  const s = input.trim().replace(',', '.')
  if (s === '' || s === '∞') return 0
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const kb = Number(s)
  return Number.isFinite(kb) ? Math.round(kb * 1024) : null
}

/** Non-negative decimal ("2,5" or "2.5"); null for empty or invalid input. */
export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
