export const LANG_KEY = 'qbit.lang'
export type Lang = 'en' | 'ru'
const DEFAULT_LANG: Lang = 'en'

function load(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    return saved === 'en' || saved === 'ru' ? saved : DEFAULT_LANG
  } catch {
    return DEFAULT_LANG
  }
}

/** Fixed for the life of the page: the dictionary is read while modules load, so changing it means a reload. */
export const lang: Lang = load()

/** For Intl formatting. en-GB: day-first dates and a 24-hour clock, like the Russian format. */
export const locale = lang === 'ru' ? 'ru' : 'en-GB'

export function setLang(next: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, next)
  } catch {
    return // nowhere to keep the choice, and a reload would lose it
  }
  window.location.reload()
}
