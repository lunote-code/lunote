import { getOutgoingLinkRefs, linkTargetMatchesDoc } from '../knowledgeRuntime'
import type { DocKey } from '../knowledgeRuntime/types'
import { getKnowledgeInteractionHost } from './ui/knowledgeInteractionHost'

export type GraphLinkCreationResult = 'ok' | 'self' | 'duplicate' | 'invalid' | 'failed'

export function formatWikiLinkMarkup(targetDocKey: DocKey, targetTitle?: string): string {
  const key = targetDocKey.trim()
  const title = targetTitle?.trim() ?? ''
  if (title && title !== key) return `[[${key}|${title}]]`
  return `[[${key}]]`
}

export function appendWikiLinkToMarkdownBody(content: string, linkMarkup: string): string {
  const trimmed = content.replace(/\s+$/u, '')
  if (!trimmed) return `${linkMarkup}\n`
  return `${trimmed}\n\n${linkMarkup}\n`
}

export function hasOutgoingWikiLink(sourceDocKey: DocKey, targetDocKey: DocKey): boolean {
  const source = sourceDocKey.trim()
  const target = targetDocKey.trim()
  if (!source || !target) return false
  return getOutgoingLinkRefs(source).some((ref) => linkTargetMatchesDoc(ref.targetDocKey, target))
}

export async function createGraphWikiLink(args: {
  sourceDocKey: DocKey
  targetDocKey: DocKey
  targetTitle?: string
}): Promise<GraphLinkCreationResult> {
  const source = args.sourceDocKey.trim()
  const target = args.targetDocKey.trim()
  if (!source || !target) return 'invalid'
  if (source === target) return 'self'
  if (hasOutgoingWikiLink(source, target)) return 'duplicate'

  const host = getKnowledgeInteractionHost()
  if (!host?.appendWikiLinkBetweenNotes) return 'failed'

  const ok = await host.appendWikiLinkBetweenNotes({
    sourceDocKey: source,
    targetDocKey: target,
    targetTitle: args.targetTitle,
  })
  return ok ? 'ok' : 'failed'
}
