import type { MessageDictionary, UiLocaleId } from './localeRegistry'
import { ensureLocaleRawLoaded, getEnMessagesSnapshot } from './localeRegistry'
import { FALLBACK_LOCALE } from './resolveLocale'

export type { MessageDictionary }

/** Shallow merging of flat dictionaries (child locale overrides parent)*/
export function mergeMessages(base: MessageDictionary, over: MessageDictionary): MessageDictionary {
  return { ...base, ...over }
}

export async function loadLocaleMessages(locale: UiLocaleId): Promise<MessageDictionary> {
  const en = getEnMessagesSnapshot()
  if (locale === 'en') return en
  const raw = await ensureLocaleRawLoaded(locale)
  return { ...en, ...raw }
}

export async function warmLocale(locale: UiLocaleId): Promise<MessageDictionary> {
  try {
    return await loadLocaleMessages(locale)
  } catch {
    return loadLocaleMessages(FALLBACK_LOCALE)
  }
}
