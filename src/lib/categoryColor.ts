/** Categories have no colour in the API, so one is derived from the name. */
export const CATEGORY_PALETTE = ['#2DD4BF', '#60A5FA', '#A78BFA', '#F472B6', '#FBBF24', '#FB923C'] as const

export function categoryColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (Math.imul(h, 31) + name.charCodeAt(i)) >>> 0
  return CATEGORY_PALETTE[h % CATEGORY_PALETTE.length]
}
