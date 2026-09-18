/** Deprecated Gemini ids that Google no longer serves on v1beta generateContent. */
const GOOGLE_LEGACY_MODEL_ALIASES: Record<string, string> = {
  'gemini-1.5-flash': 'gemini-3.5-flash',
  'gemini-1.5-flash-latest': 'gemini-3.5-flash',
  'gemini-1.5-flash-8b': 'gemini-3.5-flash',
  'gemini-1.5-pro': 'gemini-3.5-pro',
  'gemini-1.5-pro-latest': 'gemini-3.5-pro',
  'gemini-2.0-flash': 'gemini-3.5-flash',
  'gemini-2.0-flash-lite': 'gemini-3.5-flash',
  'gemini-2.0-flash-latest': 'gemini-3.5-flash',
  'gemini-2.0-pro': 'gemini-3.5-pro',
  'gemini-2.0-pro-latest': 'gemini-3.5-pro',
  'gemini-2.5-flash': 'gemini-3.5-flash',
  'gemini-2.5-flash-lite': 'gemini-3.5-flash',
  'gemini-2.5-pro': 'gemini-3.5-pro',
  'gemini-3-flash': 'gemini-3.5-flash',
  'gemini-3-flash-preview': 'gemini-3.5-flash',
  'gemini-3.1-pro': 'gemini-3.5-pro',
  'gemini-3.1-pro-preview': 'gemini-3.5-pro',
}

/** Resolve deprecated Gemini ids to current API model resource ids. */
function resolveGoogleModelAlias(modelId: string): string {
  return GOOGLE_LEGACY_MODEL_ALIASES[modelId] ?? modelId
}

/** Normalize user-facing Gemini labels to Google API model resource ids. */
export function normalizeGoogleModelId(model: string): string {
  let normalized = model.trim()
  if (!normalized) return ''

  if (normalized.startsWith('models/')) {
    normalized = normalized.slice('models/'.length)
  }

  if (/^gemini-[a-z0-9][a-z0-9.-]*$/i.test(normalized)) {
    return resolveGoogleModelAlias(normalized.toLowerCase())
  }

  if (/^gemini\b/i.test(normalized)) {
    const labelId = normalized
      .replace(/^gemini\s*/i, 'gemini-')
      .replace(/\s+/g, '-')
      .toLowerCase()
    return resolveGoogleModelAlias(labelId)
  }

  return normalized
}
