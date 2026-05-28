import type { Node as ProseMirrorNode } from 'prosemirror-model'
import {
  absolutePathToDocKey,
  getOutgoingLinkRefs,
  normalizeDocKeyForNavigation,
} from '../knowledgeRuntime'
import type { DocKey, WikiLinkTarget } from '../knowledgeRuntime/types'

export type WikiLinkHit = {
  target: WikiLinkTarget
  raw: string
  start: number
  end: number
}

type WikiInteractionDocContext = {
  rootDir: string
  activePath: string
}

function resolveActiveDocKey(ctx: WikiInteractionDocContext): DocKey | null {
  const { rootDir, activePath } = ctx
  if (!rootDir || !activePath) return null
  return absolutePathToDocKey(rootDir, activePath)
}

function findWikiLinkHitAtOffset(sourceDocKey: DocKey, offset: number): WikiLinkHit | null {
  const refs = getOutgoingLinkRefs(sourceDocKey)
  if (!refs.length) return null
  for (const ref of refs) {
    if (offset < ref.start || offset > ref.end) continue
    return {
      raw: ref.raw,
      start: ref.start,
      end: ref.end,
      target: {
        docKey: normalizeDocKeyForNavigation(ref.target.docKey || ref.targetDocKey),
        heading: ref.heading ?? ref.target.anchor?.headingSlug,
        blockId: ref.blockId ?? ref.target.anchor?.blockId,
        alias: ref.target.label,
      },
    }
  }
  return null
}

function pmPosToTextOffset(doc: ProseMirrorNode, pos: number): number {
  const clamped = Math.max(0, Math.min(pos, doc.content.size))
  let total = 0
  let resolved = false
  doc.descendants((node, nodePos) => {
    if (resolved) return false
    if (!node.isText) return true
    const text = node.text ?? ''
    const start = nodePos
    const end = nodePos + text.length
    if (clamped <= start) {
      resolved = true
      return false
    }
    if (clamped >= end) {
      total += text.length
      return true
    }
    total += Math.max(0, clamped - start)
    resolved = true
    return false
  })
  return total
}

export function resolveWikiLinkTargetAtPmPos(
  doc: ProseMirrorNode,
  pos: number,
  ctx: WikiInteractionDocContext,
): WikiLinkHit | null {
  const sourceDocKey = resolveActiveDocKey(ctx)
  if (!sourceDocKey) return null
  const offset = pmPosToTextOffset(doc, pos)
  return findWikiLinkHitAtOffset(sourceDocKey, offset)
}

export function resolveWikiLinkTargetAtCmPos(
  pos: number,
  ctx: WikiInteractionDocContext,
): WikiLinkHit | null {
  const sourceDocKey = resolveActiveDocKey(ctx)
  if (!sourceDocKey) return null
  return findWikiLinkHitAtOffset(sourceDocKey, pos)
}

