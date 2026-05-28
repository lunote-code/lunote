export const ICON_SIZE_TOKENS = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  display: 24,
} as const

export const ICON_STROKE_TOKENS = {
  hairline: 1.5,
  regular: 1.8,
  strong: 2.1,
} as const

export const ICON_TONE_TOKENS = {
  default: 'var(--color-text-primary, var(--text-primary))',
  muted: 'var(--color-text-muted, var(--text-muted))',
  accent: 'var(--color-accent-primary, var(--accent))',
  inverse: '#fff',
} as const

export type IconSizeToken = keyof typeof ICON_SIZE_TOKENS
export type IconStrokeToken = keyof typeof ICON_STROKE_TOKENS
export type IconToneToken = keyof typeof ICON_TONE_TOKENS
