import { en } from './en'
import { lang } from './lang'
import { ru } from './ru'

export { lang, locale, setLang, type Lang } from './lang'

export const t = lang === 'ru' ? ru : en

if (typeof document !== 'undefined') document.documentElement.lang = lang
