export const SETTINGS_TOKENS = {
  pageWidth: 860,
  controlHeight: 38,
  sectionRadius: 16,
  sectionGap: 28,
  rowGap: 18,
  rowControlWidth: 300,
  sidebarWidth: 220,
} as const

export type SettingsTokenName = keyof typeof SETTINGS_TOKENS
