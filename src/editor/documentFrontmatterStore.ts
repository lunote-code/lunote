import { pathCompareKey, pathsEqual } from '../lib/workspacePathUtils'
import { joinMarkdownWithFrontmatter, splitDocumentMarkdown } from './documentFrontmatter'

type FrontmatterEntry = {
  fields: Record<string, unknown>
  hadLeadingBlock: boolean
}

const byPath = new Map<string, FrontmatterEntry>()

let frontmatterRevision = 0
const frontmatterListeners = new Set<() => void>()

function bumpFrontmatterRevision(): void {
  frontmatterRevision += 1
  for (const listener of frontmatterListeners) {
    try {
      listener()
    } catch {
      /* ignore subscriber errors */
    }
  }
}

export function getDocumentFrontmatterRevision(): number {
  return frontmatterRevision
}

export function subscribeDocumentFrontmatter(listener: () => void): () => void {
  frontmatterListeners.add(listener)
  return () => {
    frontmatterListeners.delete(listener)
  }
}

function normalizeStoreKey(path: string): string {
  return pathCompareKey(path)
}

function findStoredKey(path: string): string | undefined {
  const key = normalizeStoreKey(path)
  if (byPath.has(key)) return key
  for (const storedKey of byPath.keys()) {
    if (pathsEqual(storedKey, path)) return storedKey
  }
  return undefined
}

function getEntry(path: string): FrontmatterEntry | undefined {
  const key = findStoredKey(path)
  return key ? byPath.get(key) : undefined
}

export function syncDocumentFrontmatterFromMarkdown(path: string, markdown: string): void {
  if (!path || path === 'scratch') return
  const key = normalizeStoreKey(path)
  // Drop any legacy key that compares equal but differs in string form.
  for (const storedKey of [...byPath.keys()]) {
    if (storedKey !== key && pathsEqual(storedKey, path)) byPath.delete(storedKey)
  }
  const { frontmatter, hadLeadingBlock } = splitDocumentMarkdown(markdown)
  byPath.set(key, {
    fields: { ...frontmatter },
    hadLeadingBlock,
  })
  bumpFrontmatterRevision()
}

export function hasDocumentFrontmatterCache(path: string): boolean {
  return findStoredKey(path) !== undefined
}

export function getDocumentFrontmatterFields(path: string): Record<string, unknown> | undefined {
  return getEntry(path)?.fields
}

export function getDocumentFrontmatterHadLeadingBlock(path: string): boolean {
  return getEntry(path)?.hadLeadingBlock ?? false
}

export function setDocumentFrontmatterFields(
  path: string,
  fields: Record<string, unknown>,
  options?: { hadLeadingBlock?: boolean },
): void {
  if (!path || path === 'scratch') return
  const key = normalizeStoreKey(path)
  const prev = getEntry(path)
  for (const storedKey of [...byPath.keys()]) {
    if (storedKey !== key && pathsEqual(storedKey, path)) byPath.delete(storedKey)
  }
  byPath.set(key, {
    fields: { ...fields },
    hadLeadingBlock: options?.hadLeadingBlock ?? prev?.hadLeadingBlock ?? Object.keys(fields).length > 0,
  })
  bumpFrontmatterRevision()
}

const LEADING_YAML_FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u

export function attachDocumentFrontmatter(path: string, body: string): string {
  if (!path || path === 'scratch') return body
  if (LEADING_YAML_FRONTMATTER.test(body)) return body
  const entry = getEntry(path)
  if (!entry) return body
  const { fields, hadLeadingBlock } = entry
  const hasFields = Object.keys(fields).some((k) => {
    const v = fields[k]
    if (v == null) return false
    if (Array.isArray(v)) return v.length > 0
    return true
  })
  if (!hasFields && !hadLeadingBlock) return body
  return joinMarkdownWithFrontmatter(body, fields, hadLeadingBlock)
}

export function migrateDocumentFrontmatterPath(fromPath: string, toPath: string): void {
  const fromKey = findStoredKey(fromPath)
  if (!fromKey) return
  const entry = byPath.get(fromKey)
  if (!entry) return
  byPath.delete(fromKey)
  const toKey = normalizeStoreKey(toPath)
  for (const storedKey of [...byPath.keys()]) {
    if (storedKey !== toKey && pathsEqual(storedKey, toPath)) byPath.delete(storedKey)
  }
  byPath.set(toKey, entry)
  bumpFrontmatterRevision()
}

export function clearDocumentFrontmatter(path: string): void {
  const key = findStoredKey(path)
  if (!key) return
  byPath.delete(key)
  bumpFrontmatterRevision()
}

export function clearAllDocumentFrontmatter(): void {
  if (byPath.size === 0) return
  byPath.clear()
  bumpFrontmatterRevision()
}

export function documentFrontmatterPathsEqual(a: string, b: string): boolean {
  return pathsEqual(a, b)
}
