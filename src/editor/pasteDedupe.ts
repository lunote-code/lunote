let lastSuccessfulPaste: { token: string; at: number } | null = null

const DEDUPE_MS = 500

/** Plain text is given priority; when there is no text, image metadata is used to avoid pasting pure images. dedupe fingerprint is empty*/
export function computePasteFingerprint(text: string, images: readonly File[] = []): string {
  const trimmed = text.trim()
  if (trimmed) return trimmed.slice(0, 64)
  if (images.length > 0) {
    const f = images[0]!
    return `img:${f.size}:${f.type}:${f.name}`.slice(0, 64)
  }
  return ''
}

/** The same clipboard content has been successfully pasted in the short window → skip (keydown + paste event double trigger)*/
export function shouldSkipDuplicatePaste(fingerprint: string): boolean {
  const token = fingerprint.slice(0, 64)
  if (!token) return false
  const now = Date.now()
  if (
    lastSuccessfulPaste &&
    lastSuccessfulPaste.token === token &&
    now - lastSuccessfulPaste.at < DEDUPE_MS
  ) {
    return true
  }
  return false
}

export function recordSuccessfulPaste(fingerprint: string): void {
  const token = fingerprint.slice(0, 64)
  if (!token) return
  lastSuccessfulPaste = { token, at: Date.now() }
}

export function resetPasteDedupeForTests(): void {
  lastSuccessfulPaste = null
}
