import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type { AppLanguageSetting } from '../settings/appSettingsTypes'
import { getAppSettingsSnapshot, subscribeAppSettings } from '../settings/appSettingsStore'
import type { I18nBootstrap } from './bootstrapI18n'
import { formatMessage } from './formatMessage'
import { isMenuLabelKey, resolveMenuVisibleLabel } from './menuLabel'
import { compileMenuForLocale } from '../menu/menu.compile'
import { enforceMenuLabel, STRICT_ENFORCE_LOCALES } from '../menu/menu.enforcer'
import type { PaletteCommandDef, ToolbarCommandDef, ToolbarItemDef } from '../menu/menu.types'
import { isToolbarButton } from '../menu/menu.types'
import { compileToolbarFromManifest } from '../menu/manifestCompile'
import type { UiLocaleId } from './resolveLocale'
import {
  ensureLocaleRawLoaded,
  getEnMessagesSnapshot,
} from './localeRegistry'
import { resolveEffectiveUiLocale } from './resolveLocale'
import { getCachedTauriOsLocaleTag, readTauriOsLocaleTag } from './systemLocale'
import { resolvePlatformShortcutHintText } from './platformShortcutHint'

export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string

type I18nContextValue = {
  languageSetting: AppLanguageSetting
  effectiveLocale: UiLocaleId
  t: TranslateFn
  /** Compiled from Command Manifest*/
  paletteCommands: PaletteCommandDef[]
  toolbarSidebar: ToolbarCommandDef[]
  toolbarEditorFormat: ToolbarItemDef[]
}

const I18nContext = createContext<I18nContextValue | null>(null)

type PaletteCompileState = {
  readonly paletteCommands: PaletteCommandDef[]
  readonly compileError: unknown | null
}

function getLanguageSettingSnapshot(): AppLanguageSetting {
  return getAppSettingsSnapshot().language
}

export function I18nProvider({
  children,
  bootstrap,
}: {
  children: ReactNode
  bootstrap: I18nBootstrap
}) {
  const runtimeLanguageSetting = useSyncExternalStore(
    subscribeAppSettings,
    getLanguageSettingSnapshot,
    () => bootstrap.languageSetting,
  )
  const [osLocaleReady, setOsLocaleReady] = useState(() => getCachedTauriOsLocaleTag() !== undefined)
  useEffect(() => {
    if (getCachedTauriOsLocaleTag() !== undefined) return
    void readTauriOsLocaleTag().finally(() => setOsLocaleReady(true))
  }, [])
  const navLang = typeof navigator !== 'undefined' ? navigator.language : undefined
  const effectiveLocale = useMemo(() => {
    if (!osLocaleReady && runtimeLanguageSetting === 'system') {
      return bootstrap.effectiveLocale
    }
    return resolveEffectiveUiLocale(
      runtimeLanguageSetting,
      navLang,
      getCachedTauriOsLocaleTag() ?? null,
    )
  }, [bootstrap.effectiveLocale, navLang, osLocaleReady, runtimeLanguageSetting])
  const enMessages = useMemo(() => getEnMessagesSnapshot(), [])
  const [localeBundle, setLocaleBundle] = useState(() => ({
    rawLocale: bootstrap.effectiveLocale === 'en' ? bootstrap.enMessages : bootstrap.rawLocale,
    mergedMessages: bootstrap.mergedMessages,
  }))

  useEffect(() => {
    if (effectiveLocale === bootstrap.effectiveLocale) {
      setLocaleBundle({
        rawLocale: effectiveLocale === 'en' ? bootstrap.enMessages : bootstrap.rawLocale,
        mergedMessages: bootstrap.mergedMessages,
      })
      return
    }
    let cancelled = false
    void (async () => {
      const en = getEnMessagesSnapshot()
      const raw = effectiveLocale === 'en' ? en : await ensureLocaleRawLoaded(effectiveLocale)
      if (cancelled) return
      setLocaleBundle({
        rawLocale: raw,
        mergedMessages: effectiveLocale === 'en' ? en : { ...en, ...raw },
      })
    })()
    return () => {
      cancelled = true
    }
  }, [bootstrap.effectiveLocale, bootstrap.enMessages, bootstrap.mergedMessages, bootstrap.rawLocale, effectiveLocale])

  const rawLocale = localeBundle.rawLocale
  const mergedMessages = localeBundle.mergedMessages
  const languageSetting = runtimeLanguageSetting

  const t = useCallback<TranslateFn>(
    (key, vars) => {
      let raw: string
      if (isMenuLabelKey(key) && STRICT_ENFORCE_LOCALES.has(effectiveLocale)) {
        raw = enforceMenuLabel(key, effectiveLocale, mergedMessages, enMessages, rawLocale)
      } else {
        raw = mergedMessages[key] ?? key
        raw = resolveMenuVisibleLabel(key, effectiveLocale, raw, enMessages, rawLocale)
      }
      const text = vars ? formatMessage(raw, vars) : raw
      return resolvePlatformShortcutHintText(text)
    },
    [mergedMessages, enMessages, rawLocale, effectiveLocale],
  )

  const paletteCompile = useMemo<PaletteCompileState>(() => {
    try {
      return {
        paletteCommands: compileMenuForLocale(effectiveLocale, mergedMessages, enMessages, rawLocale)
          .paletteCommands,
        compileError: null,
      }
    } catch (e) {
      return {
        paletteCommands: compileMenuForLocale('en', enMessages, enMessages, enMessages, { skipGuard: true })
          .paletteCommands,
        compileError: e,
      }
    }
  }, [effectiveLocale, mergedMessages, enMessages, rawLocale])

  const paletteCompileLoggedRef = useRef<string | null>(null)
  useEffect(() => {
    if (paletteCompile.compileError == null) {
      paletteCompileLoggedRef.current = null
      return
    }
    const signature =
      paletteCompile.compileError instanceof Error
        ? paletteCompile.compileError.message
        : String(paletteCompile.compileError)
    if (paletteCompileLoggedRef.current === signature) return
    paletteCompileLoggedRef.current = signature
    console.error('[BOOT] palette compile failed, fallback to en:', paletteCompile.compileError)
  }, [paletteCompile])

  const paletteCommands = paletteCompile.paletteCommands

  const toolbarSidebar = useMemo(
    () =>
      compileToolbarFromManifest('sidebar-header', t)
        .filter(isToolbarButton)
        .map(({ kind: _kind, ...cmd }) => cmd),
    [t],
  )

  const toolbarEditorFormat = useMemo(
    () => compileToolbarFromManifest('editor-format', t),
    [t],
  )

  const value = useMemo<I18nContextValue>(
    () => ({
      languageSetting,
      effectiveLocale,
      t,
      paletteCommands,
      toolbarSidebar,
      toolbarEditorFormat,
    }),
    [effectiveLocale, languageSetting, t, paletteCommands, toolbarSidebar, toolbarEditorFormat],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const v = useContext(I18nContext)
  if (!v) throw new Error('useI18n must be used within I18nProvider')
  return v
}
