import { formatAcceleratorForDisplay } from './menu.shortcuts'

/**
 * Typora style menu copy: `[icon] name` (shortcut keys are displayed in columns by OS / command panel)
 */
export function formatTyporaMenuTitle(
  translatedLabel: string,
  menuIcon?: string,
): string {
  const name = translatedLabel.trim()
  if (!menuIcon) return name
  return `${menuIcon} ${name}`
}

export function formatTyporaPaletteLabel(
  translatedLabel: string,
  def?: { menuIcon?: string; icon?: string },
): string {
  const icon = def?.menuIcon ?? def?.icon
  return formatTyporaMenuTitle(translatedLabel, icon)
}

export function formatTyporaPaletteHint(parts: {
  breadcrumb?: string
  accelerator?: string
  paletteHint?: string
}): string {
  const hintParts: string[] = []
  if (parts.breadcrumb) hintParts.push(parts.breadcrumb)
  const accel = formatAcceleratorForDisplay(parts.accelerator)
  if (accel) hintParts.push(accel)
  else if (parts.paletteHint) hintParts.push(parts.paletteHint)
  return hintParts.join(' · ')
}
