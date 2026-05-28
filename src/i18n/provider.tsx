import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react'
import type { AppLanguageSetting } from '../settings/appSettingsTypes'
import { getAppSettingsSnapshot, subscribeAppSettings } from '../settings/appSettingsStore'
import type { I18nBootstrap } from './bootstrapI18n'
import { formatMessage } from './formatMessage'
import { isMenuLabelKey, resolveMenuVisibleLabel } from './menuLabel'
import { compileMenuForLocale } from '../menu/menu.compile'
import { enforceMenuLabel, STRICT_ENFORCE_LOCALES } from '../menu/menu.enforcer'
import { assertMenuGuard } from '../menu/menu.guard'
import type { PaletteCommandDef, ToolbarCommandDef } from '../menu/menu.types'
import { compileToolbarFromManifest } from '../menu/manifestCompile'
import type { UiLocaleId } from './resolveLocale'
import { getEnMessagesSnapshot, getLocaleMessagesSnapshot, getLocaleRawSnapshot } from './localeRegistry'
import { resolveEffectiveUiLocale } from './resolveLocale'

export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string

type I18nContextValue = {
  languageSetting: AppLanguageSetting
  effectiveLocale: UiLocaleId
  t: TranslateFn
  /** Compiled from Command Manifest*/
  paletteCommands: PaletteCommandDef[]
  toolbarSidebar: ToolbarCommandDef[]
}

const I18nContext = createContext<I18nContextValue | null>(null)

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
  const effectiveLocale = useMemo(
    () => resolveEffectiveUiLocale(runtimeLanguageSetting, typeof navigator !== 'undefined' ? navigator.language : undefined),
    [runtimeLanguageSetting],
  )
  const enMessages = useMemo(() => getEnMessagesSnapshot(), [])
  const rawLocale = useMemo(
    () => (effectiveLocale === 'en' ? enMessages : getLocaleRawSnapshot(effectiveLocale)),
    [effectiveLocale, enMessages],
  )
  const mergedMessages = useMemo(() => getLocaleMessagesSnapshot(effectiveLocale), [effectiveLocale])
  const languageSetting = runtimeLanguageSetting

  const menuGuardOk = useMemo(() => {
    try {
      assertMenuGuard({
        locale: effectiveLocale,
        merged: mergedMessages,
        en: enMessages,
        rawLocale,
      })
      return true
    } catch {
      return false
    }
  }, [effectiveLocale, mergedMessages, enMessages, rawLocale])

  const menuGuardLoggedRef = useRef(false)
  useEffect(() => {
    if (menuGuardOk || menuGuardLoggedRef.current) return
    menuGuardLoggedRef.current = true
     
    console.error('[BOOT] menu guard soft-fail (app continues)')
  }, [menuGuardOk])

  const t = useCallback<TranslateFn>(
    (key, vars) => {
      let raw: string
      if (isMenuLabelKey(key) && STRICT_ENFORCE_LOCALES.has(effectiveLocale)) {
        raw = enforceMenuLabel(key, effectiveLocale, mergedMessages, enMessages, rawLocale)
      } else {
        raw = mergedMessages[key] ?? key
        raw = resolveMenuVisibleLabel(key, effectiveLocale, raw, enMessages, rawLocale)
      }
      return vars ? formatMessage(raw, vars) : raw
    },
    [mergedMessages, enMessages, rawLocale, effectiveLocale],
  )

  const paletteCommands = useMemo(() => {
    try {
      return compileMenuForLocale(effectiveLocale, mergedMessages, enMessages, rawLocale).paletteCommands
    } catch (e) {
       
      console.error('[BOOT] palette compile failed, fallback to en:', e)
      return compileMenuForLocale('en', enMessages, enMessages, enMessages, { skipGuard: true })
        .paletteCommands
    }
  }, [effectiveLocale, mergedMessages, enMessages, rawLocale])

  const toolbarSidebar = useMemo(
    () => compileToolbarFromManifest('sidebar-header', t),
    [t],
  )

  const value = useMemo<I18nContextValue>(
    () => ({
      languageSetting,
      effectiveLocale,
      t,
      paletteCommands,
      toolbarSidebar,
    }),
    [effectiveLocale, languageSetting, t, paletteCommands, toolbarSidebar],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const v = useContext(I18nContext)
  if (!v) throw new Error('useI18n must be used within I18nProvider')
  return v
}
