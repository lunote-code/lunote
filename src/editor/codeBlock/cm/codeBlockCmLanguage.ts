import type { LanguageDescription } from '@codemirror/language'
import { languages } from '@codemirror/language-data'

import { isPlainCodeBlockLanguage, resolveCanonicalLanguageId } from '../../lunaCodeLanguages'

const LOWLIGHT_TO_CM_ALIAS: Record<string, string[]> = {
  javascript: ['javascript', 'js'],
  typescript: ['typescript', 'ts'],
  python: ['python', 'py'],
  cpp: ['cpp', 'c++'],
  csharp: ['csharp', 'cs'],
  golang: ['go'],
  ruby: ['ruby', 'rb'],
  kotlin: ['kotlin', 'kt'],
  shell: ['shell', 'bash', 'sh'],
  plaintext: [],
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

function languageMatchesAlias(desc: LanguageDescription, alias: string): boolean {
  const q = norm(alias)
  if (!q) return false
  if (norm(desc.name) === q) return true
  return desc.alias.some((a) => norm(a) === q)
}

/** Resolve a Luna/lowlight language id to a CodeMirror `LanguageDescription`. */
export function resolveCodeMirrorLanguageDescription(
  rawLanguageId: string | null | undefined,
): LanguageDescription | null {
  if (isPlainCodeBlockLanguage(rawLanguageId)) return null
  const canonical = resolveCanonicalLanguageId(String(rawLanguageId ?? '')) ?? String(rawLanguageId ?? '').trim()
  if (!canonical || isPlainCodeBlockLanguage(canonical)) return null

  const aliases = LOWLIGHT_TO_CM_ALIAS[canonical] ?? [canonical]
  for (const alias of aliases) {
    const hit = languages.find((desc) => languageMatchesAlias(desc, alias))
    if (hit) return hit
  }

  return languages.find((desc) => languageMatchesAlias(desc, canonical)) ?? null
}
