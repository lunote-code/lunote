/**
 * Automatically discover available UI locales from `./locales/*.json` on disk (single source of data, avoid handwritten SUPPORTED list drift).
 */
export type MessageDictionary = Record<string, string>

type LocaleModule = { default: MessageDictionary }

const enLocaleModules = import.meta.glob<LocaleModule>('./locales/en.json', { eager: true })
const localeLoaders = Object.fromEntries(
  Object.entries(import.meta.glob<LocaleModule>('./locales/*.json')).filter(([path]) => !path.endsWith('/en.json')),
)

function pathToLocaleId(path: string): string {
  const m = path.match(/\.\/locales\/(.+)\.json$/)
  if (!m) throw new Error(`Unexpected locale path: ${path}`)
  return m[1]
}

export const UI_LOCALE_IDS = Object.freeze(
  [...new Set([...Object.keys(localeLoaders).map(pathToLocaleId), 'en'])].sort((a, b) => {
    if (a === 'en') return -1
    if (b === 'en') return 1
    return a.localeCompare(b)
  }),
) as readonly string[]

export type UiLocaleId = (typeof UI_LOCALE_IDS)[number]

/** Mirrors `meta.nativeName` in each locale file — used before lazy locale load (e.g. language picker). */
const LOCALE_NATIVE_NAMES: Readonly<Record<UiLocaleId, string>> = {
  en: 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  pt: 'Português (Brasil)',
  ru: 'Русский',
}

export function getLocaleNativeName(localeId: UiLocaleId): string {
  if (localeId === 'en') {
    return getEnMessagesSnapshot()['meta.nativeName']?.trim() || LOCALE_NATIVE_NAMES.en
  }
  const cachedName = localeRawCache.get(localeId)?.['meta.nativeName']?.trim()
  if (cachedName) return cachedName
  return LOCALE_NATIVE_NAMES[localeId] ?? localeId
}

export function isUiLocaleId(id: string): id is UiLocaleId {
  return (UI_LOCALE_IDS as readonly string[]).includes(id)
}

const localeRawCache = new Map<string, MessageDictionary>()

/** en baseline (all UI keys) — eager so bootstrap copy is available immediately. */
export function getEnMessagesSnapshot(): MessageDictionary {
  const mod = enLocaleModules['./locales/en.json']
  if (!mod?.default) throw new Error('Missing locale module: ./locales/en.json')
  return mod.default
}

/** Load sparse locale JSON on demand (non-en only). */
export async function ensureLocaleRawLoaded(localeId: UiLocaleId): Promise<MessageDictionary> {
  if (localeId === 'en') return getEnMessagesSnapshot()
  const cached = localeRawCache.get(localeId)
  if (cached) return cached
  const path = `./locales/${localeId}.json`
  const loader = localeLoaders[path]
  if (!loader) throw new Error(`Missing locale module: ${path}`)
  const mod = await loader()
  localeRawCache.set(localeId, mod.default)
  return mod.default
}

/** Sparse locale file original text (without merge en) - used for authenticity auditing */
export function getLocaleRawSnapshot(localeId: UiLocaleId): MessageDictionary {
  if (localeId === 'en') return getEnMessagesSnapshot()
  const cached = localeRawCache.get(localeId)
  if (!cached) {
    throw new Error(`Locale ${localeId} not loaded; call ensureLocaleRawLoaded() first`)
  }
  return cached
}

/**
 * Merged view for runtime display (only used for t() to get copy, not used for completion statistics).
 */
export function getLocaleMessagesSnapshot(localeId: UiLocaleId): MessageDictionary {
  const en = getEnMessagesSnapshot()
  if (localeId === 'en') return en
  const raw = localeRawCache.get(localeId)
  if (!raw) {
    throw new Error(`Locale ${localeId} not loaded; call ensureLocaleRawLoaded() first`)
  }
  return { ...en, ...raw }
}
