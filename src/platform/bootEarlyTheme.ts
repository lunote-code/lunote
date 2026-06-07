/** Early boot theme (before React); keep in sync with public/boot-early-theme.js */

export const BOOT_EARLY_SETTINGS_KEY = 'Lunote:appSettings:v1'
export const BOOT_EARLY_LEGACY_SETTINGS_KEY = 'CrossPlatNote:appSettings:v1'
export const BOOT_EARLY_DEFAULT_VARIANT = 'github-dark'

const BUILT_IN_VARIANTS = new Set([
  'github-light',
  'github-dark',
  'idea-light',
  'idea-dark',
  'dim-light',
  'dim-dark',
])

export type BootEarlyThemeMode = 'light' | 'dark'
export type BootEarlyThemePreset = 'github' | 'idea' | 'dim'

export type BootEarlyThemeMarkup = {
  variant: string
  mode: BootEarlyThemeMode
  preset: BootEarlyThemePreset
  surfaceApp: string
  cssFile: string
}

const SURFACE_APP: Record<string, string> = {
  'github-light': '#f6f8fa',
  'github-dark': '#0d1117',
  'idea-light': '#ffffff',
  'idea-dark': '#2b2b2b',
  'dim-light': '#d8dee9',
  'dim-dark': '#1e2030',
}

export function normalizeBootEarlyThemeVariant(value: unknown): string {
  if (typeof value !== 'string') return BOOT_EARLY_DEFAULT_VARIANT
  const trimmed = value.trim()
  if (!trimmed) return BOOT_EARLY_DEFAULT_VARIANT
  if (BUILT_IN_VARIANTS.has(trimmed)) return trimmed
  switch (trimmed) {
    case 'light':
      return 'github-light'
    case 'system':
    case 'dark':
    case 'github':
      return BOOT_EARLY_DEFAULT_VARIANT
    case 'idea':
      return 'idea-dark'
    case 'dim':
      return 'dim-dark'
    default:
      return trimmed
  }
}

export function resolveBootEarlyThemeMarkup(variantRaw: unknown, cssFileRaw?: unknown): BootEarlyThemeMarkup {
  const variant = normalizeBootEarlyThemeVariant(variantRaw)
  const cssFile = typeof cssFileRaw === 'string' ? cssFileRaw.trim() : ''

  let preset: BootEarlyThemePreset = 'github'
  if (variant.startsWith('idea-') || variant === 'idea') preset = 'idea'
  else if (variant.startsWith('dim-') || variant === 'dim') preset = 'dim'

  let mode: BootEarlyThemeMode = 'dark'
  if (variant.endsWith('-light') || variant === 'light') mode = 'light'
  else if (variant.endsWith('-dark') || variant === 'dark') mode = 'dark'

  const surfaceKey = BUILT_IN_VARIANTS.has(variant) ? variant : `${preset}-${mode}`
  const surfaceApp = SURFACE_APP[surfaceKey] ?? SURFACE_APP['github-dark']

  return { variant, mode, preset, surfaceApp, cssFile }
}

export function readBootEarlySettingsRaw(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return (
      localStorage.getItem(BOOT_EARLY_SETTINGS_KEY) ??
      localStorage.getItem(BOOT_EARLY_LEGACY_SETTINGS_KEY)
    )
  } catch {
    return null
  }
}

export function parseBootEarlyThemeFromSettingsJson(raw: string | null): BootEarlyThemeMarkup {
  if (!raw) return resolveBootEarlyThemeMarkup(BOOT_EARLY_DEFAULT_VARIANT)
  try {
    const parsed = JSON.parse(raw) as {
      appearance?: { theme?: { active?: unknown; cssFile?: unknown } }
    }
    const theme = parsed.appearance?.theme
    return resolveBootEarlyThemeMarkup(theme?.active, theme?.cssFile)
  } catch {
    return resolveBootEarlyThemeMarkup(BOOT_EARLY_DEFAULT_VARIANT)
  }
}

export function applyBootEarlyThemeMarkup(
  markup: BootEarlyThemeMarkup,
  root: HTMLElement = document.documentElement,
): void {
  root.setAttribute('data-theme', markup.mode)
  root.setAttribute('data-theme-preset', markup.preset)
  if (markup.cssFile) {
    root.setAttribute('data-theme-css-file', markup.cssFile)
  } else {
    root.removeAttribute('data-theme-css-file')
  }
  root.style.backgroundColor = markup.surfaceApp
  root.style.colorScheme = markup.mode
}

export function applyBootEarlyThemeFromLocalStorage(root?: HTMLElement): BootEarlyThemeMarkup {
  const markup = parseBootEarlyThemeFromSettingsJson(readBootEarlySettingsRaw())
  if (typeof document !== 'undefined') {
    applyBootEarlyThemeMarkup(markup, root ?? document.documentElement)
  }
  return markup
}

/** Mirror disk settings into localStorage so index.html boot script can read them on next launch. */
export function mirrorAppSettingsLocalCache(settingsJson: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(BOOT_EARLY_SETTINGS_KEY, settingsJson)
  } catch {
    /* ignore quota / private mode */
  }
}
