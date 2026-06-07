import { pathsEqual } from '../lib/workspacePathUtils'
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
  return path.replace(/\\/g, '/')
}

export function syncDocumentFrontmatterFromMarkdown(path: string, markdown: string): void {
  if (!path || path === 'scratch') return
  const key = normalizeStoreKey(path)
  const { frontmatter, hadLeadingBlock } = splitDocumentMarkdown(markdown)
  byPath.set(key, {
    fields: { ...frontmatter },
    hadLeadingBlock,
  })
  bumpFrontmatterRevision()
}

export function hasDocumentFrontmatterCache(path: string): boolean {
  return byPath.has(normalizeStoreKey(path))
}

export function getDocumentFrontmatterFields(path: string): Record<string, unknown> | undefined {
  const key = normalizeStoreKey(path)
  return byPath.get(key)?.fields
}

export function getDocumentFrontmatterHadLeadingBlock(path: string): boolean {
  const key = normalizeStoreKey(path)
  return byPath.get(key)?.hadLeadingBlock ?? false
}

export function setDocumentFrontmatterFields(
  path: string,
  fields: Record<string, unknown>,
  options?: { hadLeadingBlock?: boolean },
): void {
  if (!path || path === 'scratch') return
  const key = normalizeStoreKey(path)
  const prev = byPath.get(key)
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
  const key = normalizeStoreKey(path)
  const entry = byPath.get(key)
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
  const fromKey = normalizeStoreKey(fromPath)
  const toKey = normalizeStoreKey(toPath)
  const entry = byPath.get(fromKey)
  if (!entry) return
  byPath.set(toKey, entry)
  byPath.delete(fromKey)
  bumpFrontmatterRevision()
}

export function clearDocumentFrontmatter(path: string): void {
  if (!byPath.has(normalizeStoreKey(path))) return
  byPath.delete(normalizeStoreKey(path))
  bumpFrontmatterRevision()
}

export function documentFrontmatterPathsEqual(a: string, b: string): boolean {
  return pathsEqual(a, b)
}
