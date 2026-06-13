/**
 * Localization authenticity audit: does not rely on merge results to judge completion.
 *
 * - translated: The key exists in the locale sparse file, and the copy ≠ en
 * - fallback: There is a key in the file but it is the same as en (pseudo translation), or it will be taken over by en at runtime
 * - missing: the key does not exist in the sparse file (fallback to en during runtime)
 */
import type { MessageDictionary, UiLocaleId } from './localeRegistry'
import { getEnMessagesSnapshot, getLocaleRawSnapshot } from './localeRegistry'

export type KeyTranslationSource = 'translated' | 'fallback' | 'missing'

export type KeyTranslationInfo = {
  key: string
  source: KeyTranslationSource
  /** The copy the user finally sees (consistent with runtime t())*/
  displayValue: string
  /** Values in sparse locale files; undefined when missing*/
  localeValue: string | undefined
  enValue: string
}

export type LocaleTruthStats = {
  nativeName: string
  /** Proportion of real native language translations (relative to en all UI keys)*/
  translated: number
  /** The proportion of the same text as en (placeholder in the file)*/
  fallback: number
  /** Proportion of unprovided keys in sparse files*/
  missing: number
  totalKeys: number
  counts: {
    translated: number
    fallback: number
    missing: number
  }
}

const META_PREFIX = 'meta.'

function isMetaKey(key: string): boolean {
  return key.startsWith(META_PREFIX)
}

export function getComparableUiKeys(en: MessageDictionary): string[] {
  return Object.keys(en).filter((k) => !isMetaKey(k))
}

/** Single key classification (only look at the sparse locale + en benchmark, no merge)*/
export function classifyUiKey(
  key: string,
  en: MessageDictionary,
  rawLocale: MessageDictionary,
): KeyTranslationInfo | null {
  if (isMetaKey(key)) return null
  const enValue = en[key]
  if (enValue === undefined) return null

  const hasOwn = Object.prototype.hasOwnProperty.call(rawLocale, key)
  if (!hasOwn) {
    return {
      key,
      source: 'missing',
      displayValue: enValue,
      localeValue: undefined,
      enValue,
    }
  }

  const localeValue = rawLocale[key]!
  if (localeValue === enValue) {
    return {
      key,
      source: 'fallback',
      displayValue: localeValue,
      localeValue,
      enValue,
    }
  }

  return {
    key,
    source: 'translated',
    displayValue: localeValue,
    localeValue,
    enValue,
  }
}

function pct(count: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((100 * count) / total)))
}

function tryLocaleRaw(localeId: UiLocaleId, en: MessageDictionary): MessageDictionary {
  if (localeId === 'en') return en
  try {
    return getLocaleRawSnapshot(localeId)
  } catch {
    return { 'meta.nativeName': localeId }
  }
}

/** Calculate the true degree of completion based on sparse files (the use of merged dictionaries is prohibited)*/
export function computeLocaleTruthStats(
  localeId: UiLocaleId,
  en: MessageDictionary = getEnMessagesSnapshot(),
  rawLocale: MessageDictionary = tryLocaleRaw(localeId, en),
): LocaleTruthStats {
  const keys = getComparableUiKeys(en)
  let translated = 0
  let fallback = 0
  let missing = 0

  if (localeId === 'en') {
    return {
      nativeName: rawLocale['meta.nativeName']?.trim() || 'English',
      translated: 100,
      fallback: 0,
      missing: 0,
      totalKeys: keys.length,
      counts: { translated: keys.length, fallback: 0, missing: 0 },
    }
  }

  for (const key of keys) {
    const info = classifyUiKey(key, en, rawLocale)
    if (!info) continue
    if (info.source === 'translated') translated += 1
    else if (info.source === 'fallback') fallback += 1
    else missing += 1
  }

  const nativeName =
    rawLocale['meta.nativeName']?.trim() ||
    (localeId === 'zh-CN' ? '简体中文' : localeId === 'zh-TW' ? '繁體中文' : localeId)

  return {
    nativeName,
    translated: pct(translated, keys.length),
    fallback: pct(fallback, keys.length),
    missing: pct(missing, keys.length),
    totalKeys: keys.length,
    counts: { translated, fallback, missing },
  }
}

export function formatLocaleTruthLabel(stats: LocaleTruthStats): string {
  return `${stats.nativeName}（${stats.translated}% translated / ${stats.fallback}% fallback / ${stats.missing}% missing）`
}

export function readLocaleMeta(localeId: UiLocaleId): LocaleTruthStats {
  return computeLocaleTruthStats(localeId)
}

/** List all fallback / missing keys (for debug and CI reporting)*/
export function listNonTranslatedKeys(localeId: UiLocaleId): {
  fallback: KeyTranslationInfo[]
  missing: KeyTranslationInfo[]
} {
  const en = getEnMessagesSnapshot()
  const raw = tryLocaleRaw(localeId, en)
  const fallback: KeyTranslationInfo[] = []
  const missing: KeyTranslationInfo[] = []

  for (const key of getComparableUiKeys(en)) {
    const info = classifyUiKey(key, en, raw)
    if (!info) continue
    if (info.source === 'fallback') fallback.push(info)
    else if (info.source === 'missing') missing.push(info)
  }

  return { fallback, missing }
}
