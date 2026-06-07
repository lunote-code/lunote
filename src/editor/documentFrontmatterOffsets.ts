import { parseFrontmatter } from './knowledgeRuntime/wikiLinkParser'

const LEADING_YAML_FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u

/** Byte length of a leading `---` YAML block in `fullMarkdown`, or 0. */
export function computeLeadingFrontmatterPrefixLength(fullMarkdown: string): number {
  const m = fullMarkdown.match(LEADING_YAML_FRONTMATTER)
  return m ? m[0]!.length : 0
}

export function clampDocumentOffset(offset: number, maxLength: number): number {
  if (!Number.isFinite(offset) || maxLength <= 0) return 0
  return Math.max(0, Math.min(maxLength, Math.floor(offset)))
}

/** Map a body-only offset (PM / visual) into a full source buffer that may include YAML. */
export function bodyOffsetToSourceOffset(
  bodyOffset: number,
  frontmatterPrefixLength: number,
  sourceLength: number,
): number {
  return clampDocumentOffset(bodyOffset + frontmatterPrefixLength, sourceLength)
}

/** Map a CodeMirror offset in a full source buffer back to body-only coordinates. */
export function sourceOffsetToBodyOffset(
  sourceOffset: number,
  frontmatterPrefixLength: number,
  bodyLength: number,
): number {
  if (frontmatterPrefixLength <= 0) {
    return clampDocumentOffset(sourceOffset, bodyLength)
  }
  if (sourceOffset <= frontmatterPrefixLength) return 0
  return clampDocumentOffset(sourceOffset - frontmatterPrefixLength, bodyLength)
}

export type SourceBodySelection = {
  bodyAnchor: number
  bodyHead: number
}

export function sourceSelectionToBodySelection(
  sourceAnchor: number,
  sourceHead: number,
  frontmatterPrefixLength: number,
  bodyLength: number,
): SourceBodySelection {
  return {
    bodyAnchor: sourceOffsetToBodyOffset(sourceAnchor, frontmatterPrefixLength, bodyLength),
    bodyHead: sourceOffsetToBodyOffset(sourceHead, frontmatterPrefixLength, bodyLength),
  }
}

export function splitFullSourceMarkdown(fullMarkdown: string): {
  body: string
  frontmatterPrefixLength: number
} {
  const frontmatterPrefixLength = computeLeadingFrontmatterPrefixLength(fullMarkdown)
  const body = parseFrontmatter(fullMarkdown).body
  return { body, frontmatterPrefixLength }
}

function clampScrollRatio(ratio: number | undefined): number | undefined {
  if (ratio == null || !Number.isFinite(ratio)) return undefined
  return Math.max(0, Math.min(1, ratio))
}

/**
 * Map PM (body-only) scroll ratio to an approximate full-source scroll ratio.
 * Uses a character-weighted prefix share so visual top-of-body does not land in YAML.
 */
export function bodyScrollRatioToSourceScrollRatio(
  bodyScrollRatio: number | undefined,
  frontmatterPrefixLength: number,
  sourceLength: number,
): number | undefined {
  const bodyRatio = clampScrollRatio(bodyScrollRatio)
  if (bodyRatio == null) return undefined
  if (frontmatterPrefixLength <= 0 || sourceLength <= frontmatterPrefixLength) return bodyRatio
  const prefixShare = frontmatterPrefixLength / sourceLength
  return clampScrollRatio(prefixShare + bodyRatio * (1 - prefixShare))!
}

/** Map full-source scroll ratio back to body-only coordinates for PM restore. */
export function sourceScrollRatioToBodyScrollRatio(
  sourceScrollRatio: number | undefined,
  frontmatterPrefixLength: number,
  sourceLength: number,
): number | undefined {
  const sourceRatio = clampScrollRatio(sourceScrollRatio)
  if (sourceRatio == null) return undefined
  if (frontmatterPrefixLength <= 0 || sourceLength <= frontmatterPrefixLength) return sourceRatio
  const prefixShare = frontmatterPrefixLength / sourceLength
  if (sourceRatio <= prefixShare) return 0
  return clampScrollRatio((sourceRatio - prefixShare) / (1 - prefixShare))
}
