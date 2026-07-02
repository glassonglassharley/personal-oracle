import { createContext, useContext } from 'react'
import T from './i18n'

export const LanguageContext = createContext('en')

export function useT() {
  const lang = useContext(LanguageContext)
  return function t(key, vars) {
    const str = T[lang]?.[key] ?? T.en?.[key] ?? key
    if (!vars) return str
    return Object.entries(vars).reduce(
      (s, [k, v]) => s.replace(`{${k}}`, String(v)),
      str
    )
  }
}
