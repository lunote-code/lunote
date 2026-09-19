import type { Node as ProseMirrorNode } from 'prosemirror-model'

import { parseMarkdownToDoc } from '../markdownDocument'
import { getOutlineParseSchema } from '../markdownOutlineFromMarkdown'
import { findWikiLinkAtOffset, parseWikiLinksInText } from '../knowledgeRuntime/wikiLinkParser'
import { resolveWikiLinkTargetAtPmPos } from './wikiInteractionMetadata'

const PICSUM_ID_237 = 'https://picsum.photos/id/237/536/354'

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

function findNodePos(doc: ProseMirrorNode, predicate: (node: ProseMirrorNode) => boolean): number | null {
  let found: number | null = null
  doc.descendants((node, pos) => {
    if (found != null) return false
    if (predicate(node)) {
      found = pos
      return false
    }
    return true
  })
  return found
}

function sourceWikiContainingOffset(
  markdown: string,
  offset: number,
): { raw: string; target: string } | null {
  const { links, embeds } = parseWikiLinksInText(markdown)
  for (const entry of [...links, ...embeds]) {
    if (offset >= entry.start && offset <= entry.end) {
      return { raw: entry.raw, target: entry.target.docKey }
    }
  }
  return null
}

/**
 * Vault fixture `测试笔记/obsidn.md`: clicking the picsum URL/image used markdown
 * wiki source ranges against visual text offsets, so `[[当前文档#…]]` stole the click.
 */
export function assertObsidnPicsumClickIsNotCurrentDocWiki(markdown: string): void {
  if (!markdown.includes(PICSUM_ID_237) || !markdown.includes('[[当前文档#标题]]')) {
    throw new Error('fixture must be 测试笔记/obsidn.md with picsum URL and [[当前文档]] wikis')
  }

  const schema = getOutlineParseSchema()
  const doc = parseMarkdownToDoc(markdown, schema)
  const imagePos = findNodePos(doc, (node) => {
    const src = String(node.attrs?.src ?? '')
    return node.type.name === 'image' && src.includes('picsum.photos/id/237')
  })
  if (imagePos == null) {
    throw new Error('obsidn.md fixture must parse a picsum id/237 image node')
  }

  const autolinkOffset = doc.textContent.indexOf(PICSUM_ID_237)
  if (autolinkOffset < 0) {
    throw new Error('obsidn.md visual text must include the picsum autolink URL')
  }

  const urlProbe = autolinkOffset + 5
  const staleSourceHit = sourceWikiContainingOffset(markdown, urlProbe)
  if (staleSourceHit?.target !== '当前文档') {
    throw new Error(
      `precondition: visual URL offset ${urlProbe} mixed with markdown wiki ranges should hit 当前文档, got ${staleSourceHit?.raw ?? 'none'}`,
    )
  }

  const urlToken = findWikiLinkAtOffset(doc.textContent, urlProbe)
  if (urlToken?.target.docKey === '当前文档') {
    throw new Error(`visual URL click must not hit [[当前文档]], got ${urlToken.raw}`)
  }
  if (urlToken) {
    throw new Error(`visual URL click must not hit a wiki token, got ${urlToken.raw}`)
  }

  const imageOffset = pmPosToTextOffset(doc, imagePos)
  const imageToken = findWikiLinkAtOffset(doc.textContent, imageOffset)
  if (imageToken) {
    throw new Error(`visual image click must not hit a wiki token, got ${imageToken.raw}`)
  }

  const hit = resolveWikiLinkTargetAtPmPos(doc, imagePos, {
    rootDir: '/vault',
    activePath: '/vault/obsidn.md',
  })
  if (hit) {
    throw new Error(`resolveWikiLinkTargetAtPmPos must ignore picsum image click, got ${hit.raw}`)
  }
}

export async function assertWikiInteractionSuite(markdown: string): Promise<{ passed: number; failed: number }> {
  try {
    assertObsidnPicsumClickIsNotCurrentDocWiki(markdown)
    return { passed: 1, failed: 0 }
  } catch (error) {
    console.error('[wikiInteraction]', error)
    return { passed: 0, failed: 1 }
  }
}
