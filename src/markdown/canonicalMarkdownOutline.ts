import {
  activeHeadingIdBeforeMarkdownOffset,
  headingContentStartOffsetInLine,
  sourceLineNumberForHeadingId,
} from '../editor/markdownDocument'

/**
 * Shared adapter for source-markdown outline / heading lookup semantics.
 * Keeps "read-only markdown navigation" utilities grouped outside editor internals,
 * so callers do not need to import heading helpers from `markdownDocument`.
 */
export const canonicalMarkdownOutline = {
  activeHeadingIdBeforeOffset(markdown: string, cursorOffset: number): string {
    return activeHeadingIdBeforeMarkdownOffset(markdown, cursorOffset)
  },
  sourceLineNumberForHeadingId(markdown: string, headingId: string): number | null {
    return sourceLineNumberForHeadingId(markdown, headingId)
  },
  headingContentStartOffsetInLine(lineText: string): number {
    return headingContentStartOffsetInLine(lineText)
  },
}
