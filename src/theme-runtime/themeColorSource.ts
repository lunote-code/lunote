export type ThemeColorSourceSettings = {
  active?: string
  cssFile?: string
  cssContent?: string
  cssImportFile?: string
}

export function isExternalThemeCssActive(theme: ThemeColorSourceSettings | undefined): boolean {
  const cssFile = typeof theme?.cssFile === 'string' ? theme.cssFile.trim() : ''
  const cssContent = typeof theme?.cssContent === 'string' ? theme.cssContent.trim() : ''
  return Boolean(cssFile || cssContent)
}

export function isBuiltinThemeColorsActive(theme: ThemeColorSourceSettings | undefined): boolean {
  return !isExternalThemeCssActive(theme)
}

export const EXTERNAL_THEME_CSS_CLEAR_FIELDS = {
  cssFile: '',
  cssContent: '',
  cssImportFile: '',
} as const satisfies Partial<ThemeColorSourceSettings>
