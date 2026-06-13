export { I18nProvider, useI18n, type TranslateFn } from './provider'
export { bootstrapI18n, type I18nBootstrap } from './bootstrapI18n'
export { formatMessage } from './formatMessage'
export { mergeMessages, warmLocale, type MessageDictionary } from './loadMessages'
export {
  computeLocaleTruthStats,
  formatLocaleTruthLabel,
  listNonTranslatedKeys,
  readLocaleMeta,
  type KeyTranslationInfo,
  type KeyTranslationSource,
  type LocaleTruthStats,
} from './localeAudit'
export {
  getEnMessagesSnapshot,
  getLocaleNativeName,
  getLocaleMessagesSnapshot,
  getLocaleRawSnapshot,
  isUiLocaleId,
  UI_LOCALE_IDS,
  type UiLocaleId,
} from './localeRegistry'
export {
  FALLBACK_LOCALE,
  resolveEffectiveUiLocale,
  resolveNavigatorLocaleTag,
  SUPPORTED_UI_LOCALES,
} from './resolveLocale'
