function channelToHex(channel: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(channel)))
  return clamped.toString(16).padStart(2, '0')
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`
}

/** Normalize app surface colors into #rrggbb for native window chrome sync. */
export function resolveWindowBackgroundHex(color: string): string | null {
  const trimmed = color.trim()
  if (!trimmed) return null

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1]!
    const g = trimmed[2]!
    const b = trimmed[3]!
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }

  const rgbMatch = trimmed.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i)
  if (rgbMatch) {
    return rgbToHex(Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3]))
  }

  return null
}

/** Read the painted root background after CSS variables / custom themes apply. */
export function resolveDocumentRootBackgroundHex(): string | null {
  if (typeof document === 'undefined') return null
  const computed = getComputedStyle(document.documentElement).backgroundColor
  return resolveWindowBackgroundHex(computed)
}
