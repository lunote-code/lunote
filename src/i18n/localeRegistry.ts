/**
 * Automatically discover available UI locales from `./locales/*.json` on disk (single source of data, avoid handwritten SUPPORTED list drift).
 */
export type MessageDictionary = Record<string, string>

type LocaleModule = { default: MessageDictionary }

const localeModules = import.meta.glob<LocaleModule>('./locales/*.json', { eager: true })

function pathToLocaleId(path: string): string {
  const m = path.match(/\.\/locales\/(.+)\.json$/)
  if (!m) throw new Error(`Unexpected locale path: ${path}`)
  return m[1]
}

export const UI_LOCALE_IDS = Object.freeze(
  [...new Set(Object.keys(localeModules).map(pathToLocaleId))].sort((a, b) => {
    if (a === 'en') return -1
    if (b === 'en') return 1
    return a.localeCompare(b)
  }),
) as readonly string[]

export type UiLocaleId = (typeof UI_LOCALE_IDS)[number]

export function isUiLocaleId(id: string): id is UiLocaleId {
  return (UI_LOCALE_IDS as readonly string[]).includes(id)
}

/** en baseline (all UI keys)*/
export function getEnMessagesSnapshot(): MessageDictionary {
  const mod = localeModules['./locales/en.json']
  if (!mod?.default) throw new Error('Missing locale module: ./locales/en.json')
  return mod.default
}

/** Sparse locale file original text (without merge en) - used for authenticity auditing*/
export function getLocaleRawSnapshot(localeId: UiLocaleId): MessageDictionary {
  const path = `./locales/${localeId}.json`
  const mod = localeModules[path]
  if (!mod?.default) throw new Error(`Missing locale module: ${path}`)
  return mod.default
}

/**
 * Merged view for runtime display (only used for t() to get copy, not used for completion statistics).
 */
export function getLocaleMessagesSnapshot(localeId: UiLocaleId): MessageDictionary {
  const en = getEnMessagesSnapshot()
  if (localeId === 'en') return en
  return { ...en, ...getLocaleRawSnapshot(localeId) }
}

