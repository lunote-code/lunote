import { proseMirrorLowlight } from './proseMirrorLowlight'

/** Aligned with lowlight registration name; aliases used for search and tab normalization*/
export type LunaCodeLanguage = {
  id: string
  displayName: string
  aliases?: string[]
}

const RECENT_KEY = 'luna.codeLang.recent'
const RECENT_MAX = 12

const DISPLAY_OVERRIDES: Record<string, { displayName?: string; aliases?: string[] }> = {
  javascript: { displayName: 'JavaScript', aliases: ['js', 'mjs', 'cjs', 'node'] },
  typescript: { displayName: 'TypeScript', aliases: ['ts', 'tsx'] },
  cpp: { displayName: 'C++', aliases: ['cplusplus', 'c++'] },
  csharp: { displayName: 'C#', aliases: ['cs'] },
  python: { aliases: ['py'] },
  rust: { aliases: ['rs'] },
  go: { aliases: ['golang'] },
  bash: { aliases: ['sh', 'shell', 'zsh'] },
  plaintext: { displayName: 'Plain text', aliases: ['text', 'txt', 'plain'] },
  markdown: { aliases: ['md'] },
  json: { aliases: [] },
  yaml: { aliases: ['yml'] },
  php: { aliases: [] },
  java: { aliases: [] },
  kotlin: { aliases: ['kt'] },
  swift: { aliases: [] },
  ruby: { aliases: ['rb'] },
  sql: { aliases: [] },
  graphql: { aliases: ['gql'] },
}

function humanizeId(id: string): string {
  if (id === 'cpp') return 'C++'
  if (id === 'csharp') return 'C#'
  return id
    .split(/[-_]/u)
    .map((p) => (p.length ? p[0].toUpperCase() + p.slice(1) : p))
    .join(' ')
}

let cachedList: LunaCodeLanguage[] | null = null

/** Build language table from current lowlight(common) instance (singleton cache)*/
export function getLunaCodeLanguages(): LunaCodeLanguage[] {
  if (cachedList) return cachedList
  const ids = proseMirrorLowlight.listLanguages().sort((a, b) => a.localeCompare(b))
  cachedList = ids.map((id) => {
    const o = DISPLAY_OVERRIDES[id]
    return {
      id,
      displayName: o?.displayName ?? humanizeId(id),
      aliases: Array.from(new Set([id, ...(o?.aliases ?? [])].map((s) => s.toLowerCase()))),
    }
  })
  if (!cachedList.some((l) => l.id === 'mermaid')) {
    cachedList = [
      ...cachedList,
      { id: 'mermaid', displayName: 'Mermaid', aliases: ['diagram', 'flowchart', 'sequence'] },
    ].sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }))
  }
  return cachedList
}

export function readRecentLanguageIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter((x): x is string => typeof x === 'string')
  } catch {
    return []
  }
}

export function bumpRecentLanguageId(id: string): void {
  const cur = readRecentLanguageIds().filter((x) => x !== id)
  cur.unshift(id)
  const next = cur.slice(0, RECENT_MAX)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota */
  }
}

const norm = (s: string) => s.trim().toLowerCase()

/** Substring matching + simple prefix weighting; case insensitive*/
export function scoreLanguageMatch(lang: LunaCodeLanguage, q: string): number {
  const nq = norm(q)
  if (!nq) return 1
  const id = norm(lang.id)
  const dn = norm(lang.displayName)
  const aliasHit = (lang.aliases ?? []).some((a) => norm(a).includes(nq) || nq.includes(norm(a)))
  if (id === nq || dn === nq) return 1000
  if (lang.aliases?.some((a) => norm(a) === nq)) return 900
  if (id.startsWith(nq) || dn.startsWith(nq)) return 500 + Math.max(0, 20 - nq.length)
  if (id.includes(nq) || dn.includes(nq)) return 200
  if (aliasHit) return 150
  let score = 0
  for (const ch of nq) {
    if (id.includes(ch)) score += 1
  }
  return score > nq.length * 0.6 ? 50 + score : 0
}

export function filterAndSortLanguages(
  languages: LunaCodeLanguage[],
  query: string,
  recentIds: string[],
): LunaCodeLanguage[] {
  const nq = norm(query)
  const recentSet = new Set(recentIds)
  const scored = languages
    .map((lang) => ({ lang, s: scoreLanguageMatch(lang, nq) }))
    .filter((x) => x.s > 0 || !nq)
    .sort((a, b) => {
      if (b.s !== a.s) return b.s - a.s
      const ra = recentSet.has(a.lang.id) ? recentIds.indexOf(a.lang.id) : 999
      const rb = recentSet.has(b.lang.id) ? recentIds.indexOf(b.lang.id) : 999
      if (ra !== rb) return ra - rb
      return a.lang.displayName.localeCompare(b.lang.displayName, undefined, { sensitivity: 'base' })
    })
  return scored.map((x) => x.lang)
}

/** Resolve alias/displayname to registered canonical id*/
export function resolveCanonicalLanguageId(raw: string): string | null {
  const q = norm(raw)
  if (!q) return null
  const langs = getLunaCodeLanguages()
  for (const lang of langs) {
    if (norm(lang.id) === q) return lang.id
    if (norm(lang.displayName) === q) return lang.id
    for (const a of lang.aliases ?? []) {
      if (norm(a) === q) return lang.id
    }
  }
  return null
}

/** CJK-heavy samples should not use highlightAuto (word splitting breaks gutter line metrics). */
export function shouldAvoidHighlightAuto(text: string): boolean {
  if (!text.length) return false
  let cjk = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0x3040 && code <= 0x30ff) ||
      (code >= 0xac00 && code <= 0xd7af)
    ) {
      cjk += 1
    }
  }
  return cjk / text.length >= 0.12
}

/** Cmd+Shift+K / Plain text code block: no lowlight syntax coloring (to avoid highlightAuto word splitting causing Chinese baseline dislocation)*/
export function isPlainCodeBlockLanguage(raw: string | null | undefined): boolean {
  const c = norm(String(raw ?? ''))
  if (!c) return true
  return c === 'text' || c === 'txt' || c === 'plain' || c === 'plaintext'
}

export function normalizeLanguageForLowlight(id: string): string {
  const c = resolveCanonicalLanguageId(id) ?? id
  if (norm(c) === 'mermaid') return 'mermaid'
  if (proseMirrorLowlight.registered(c)) return c
  if (proseMirrorLowlight.registered('plaintext')) return 'plaintext'
  return c
}

function hasAny(text: string, needles: readonly string[]): boolean {
  for (const n of needles) {
    if (text.includes(n)) return true
  }
  return false
}

/**
 * Lightweight rule detection: used to automatically add language to the code block after pasting (without overwriting the specified language).
 */
export function detectLanguageFromCodeSample(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  if (text.length > 20000) return null
  const lower = text.toLowerCase()
  const lines = text.split(/\r?\n/u)
  const head = lines.slice(0, 40).join('\n')
  const headLower = head.toLowerCase()

  // C / C++
  const hasInclude = /(^|\n)\s*#include\s*<[^>]+>/u.test(head)
  const hasMainLike = /\bint\s+main\s*\(/u.test(text)
  if (hasInclude) {
    if (hasAny(headLower, ['<iostream>', 'std::', 'using namespace std']) || /\b(class|template)\b/u.test(text)) {
      return 'cpp'
    }
    if (hasMainLike || hasAny(headLower, ['<stdio.h>', '<stdlib.h>', '<string.h>', 'printf(', 'scanf('])) {
      return 'c'
    }
  }

  if (hasMainLike && /#include/u.test(text)) return 'c'
  if (hasAny(lower, ['std::', 'cout <<', 'cin >>', 'namespace std']) && /#include/u.test(text)) return 'cpp'

  // Common languages
  if (/^\s*<\?php/u.test(text)) return 'php'
  if (/^\s*(from|import)\s+\w+/u.test(head) && /\bdef\s+\w+\s*\(/u.test(text)) return 'python'
  if (/\bconsole\.log\s*\(|\bfunction\s+\w+\s*\(|\b(const|let)\s+\w+/u.test(text)) {
    if (/\binterface\s+\w+|\btype\s+\w+\s*=|:\s*(string|number|boolean|unknown|any)\b/u.test(text)) return 'typescript'
    return 'javascript'
  }
  if (/^\s*package\s+\w+/u.test(head) && /\bfunc\s+main\s*\(/u.test(text)) return 'go'
  if (/^\s*(public\s+)?class\s+\w+/u.test(head) && /\bpublic\s+static\s+void\s+main\s*\(/u.test(text)) return 'java'
  if (/^\s*#\s*include/u.test(head) && /\bprintf\s*\(/u.test(text)) return 'c'
  if (/^\s*(select|insert|update|delete)\b/u.test(headLower) && hasAny(headLower, [' from ', ' where ', ' join ', ' group by '])) return 'sql'
  if (/^\s*[{[]/u.test(text) && /[:]/u.test(text) && /[}\]]\s*$/u.test(text)) return 'json'
  if (/^\s*---\s*$/u.test(lines[0] ?? '') && /\w+:\s+\S+/u.test(lines.slice(1, 20).join('\n'))) return 'yaml'

  return null
}
