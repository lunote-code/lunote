import type { ThemeColorTokens } from './themeTypes'

type ContrastTokenInput = Pick<ThemeColorTokens, 'background' | 'foreground' | 'muted'> & {
  surface?: string
}

const DARK_BG_MAX_BRIGHTNESS = 128
const LIGHT_FG_MAX_BRIGHTNESS = 116
const DARK_FG_MIN_BRIGHTNESS = 150
const LIGHT_BG_MIN_BRIGHTNESS = 168
const MUTED_MIN_DELTA = 34

function parseHexColor(color: string): [number, number, number] | null {
  const trimmed = color.trim()
  if (!trimmed.startsWith('#')) return null
  const hex = trimmed.slice(1)
  if (hex.length === 3) {
    const r = Number.parseInt(hex[0] + hex[0], 16)
    const g = Number.parseInt(hex[1] + hex[1], 16)
    const b = Number.parseInt(hex[2] + hex[2], 16)
    return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? null : [r, g, b]
  }
  if (hex.length !== 6) return null
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? null : [r, g, b]
}

function brightness(color: string): number | null {
  const rgb = parseHexColor(color)
  if (!rgb) return null
  const [r, g, b] = rgb
  return (r * 299 + g * 587 + b * 114) / 1000
}

function hasReadableForeground(background: number, foreground: number): boolean {
  if (background <= DARK_BG_MAX_BRIGHTNESS) return foreground >= DARK_FG_MIN_BRIGHTNESS
  if (background >= LIGHT_BG_MIN_BRIGHTNESS) return foreground <= LIGHT_FG_MAX_BRIGHTNESS
  return Math.abs(background - foreground) >= 72
}

function hasTokenSeparation(background: number, token: number): boolean {
  return Math.abs(background - token) >= MUTED_MIN_DELTA
}

export function validateThemeContrast(tokens: ContrastTokenInput): boolean {
  const bg = brightness(tokens.background)
  const fg = brightness(tokens.foreground)
  const muted = brightness(tokens.muted)
  const surface = brightness(tokens.surface ?? tokens.background)

  // Non-hex CSS colors are allowed through; built-in and custom themes can still use CSS variables.
  if (bg == null || fg == null) return true
  if (!hasReadableForeground(bg, fg)) return false
  if (muted != null && !hasTokenSeparation(bg, muted)) return false
  if (surface != null && Math.abs(bg - surface) > 24 && !hasTokenSeparation(surface, fg)) return false
  return true
}
