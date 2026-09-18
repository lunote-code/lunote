import {
  getDocumentFrontmatterFields,
  hasDocumentFrontmatterCache,
} from '../../documentFrontmatterStore'
import { getDocumentMeta } from '../../knowledgeRuntime'
import { parseFrontmatter } from '../../knowledgeRuntime/wikiLinkParser'
import { docKeyToAbsolutePath } from '../../knowledgeOS/vaultRuntime'
import { getKnowledgeInteractionHost } from '../../knowledgeOS/ui/knowledgeInteractionHost'

const YAML_FENCE_RE = /^```(?:yaml|yml)?\s*\n([\s\S]*?)\n```\s*$/iu

function stripYamlFence(text: string): string {
  const match = YAML_FENCE_RE.exec(text.trim())
  return match?.[1]?.trim() ?? text.trim()
}

/** Wrap bare YAML or incomplete --- blocks so parseFrontmatter can read them. */
function normalizeFrontmatterBlock(text: string): string {
  let block = stripYamlFence(text)
  if (!block.startsWith('---')) {
    block = `---\n${block}\n---`
  } else if (!/\r?\n---\s*$/u.test(block)) {
    block = `${block}\n---`
  }
  return block.endsWith('\n') ? block : `${block}\n`
}

export function parseAssistantFrontmatter(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const { frontmatter } = parseFrontmatter(normalizeFrontmatterBlock(trimmed))
  return Object.keys(frontmatter).length > 0 ? frontmatter : null
}

export function formatDocumentFrontmatterSummary(fields: Record<string, unknown>): string | null {
  const keys = Object.keys(fields)
  if (keys.length === 0) return null
  const lines = keys.map((key) => {
    const value = fields[key]
    if (Array.isArray(value)) return `${key}: ${value.join(', ')}`
    if (value != null && typeof value === 'object') return `${key}: ${JSON.stringify(value)}`
    return `${key}: ${String(value ?? '')}`
  })
  return lines.join('\n')
}

export function readDocumentFrontmatterFieldsForDocKey(docKey: string | null): Record<string, unknown> {
  if (!docKey) return {}
  const host = getKnowledgeInteractionHost()
  const rootDir = host?.getRootDir() ?? ''
  if (rootDir) {
    const absolutePath = docKeyToAbsolutePath(docKey, rootDir)
    if (absolutePath && hasDocumentFrontmatterCache(absolutePath)) {
      return { ...(getDocumentFrontmatterFields(absolutePath) ?? {}) }
    }
  }
  return { ...(getDocumentMeta(docKey)?.frontmatter ?? {}) }
}
