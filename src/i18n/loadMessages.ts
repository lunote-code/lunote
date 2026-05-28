import type { MessageDictionary, UiLocaleId } from './localeRegistry'
import { getLocaleMessagesSnapshot } from './localeRegistry'
import { FALLBACK_LOCALE } from './resolveLocale'

export type { MessageDictionary }

/** Shallow merging of flat dictionaries (child locale overrides parent)*/
export function mergeMessages(base: MessageDictionary, over: MessageDictionary): MessageDictionary {
  return { ...base, ...over }
}

export async function loadLocaleMessages(locale: UiLocaleId): Promise<MessageDictionary> {
  //localeRegistry has loaded all JSON through eager glob; there is no more dynamic import here to avoid invalid subpackaging warnings
  return getLocaleMessagesSnapshot(locale)
}

export async function warmLocale(locale: UiLocaleId): Promise<MessageDictionary> {
  try {
    return await loadLocaleMessages(locale)
  } catch {
    return loadLocaleMessages(FALLBACK_LOCALE)
  }
}
