import type { EditorAnchorRevealRequest } from '../editorAnchorNavigation'

/**
 * App Host Contract: The only injection point, dispersing interaction branches within the App is prohibited.
 */
export type KnowledgeInteractionHost = {
  getRootDir: () => string | null
  openAbsolutePath: (absolutePath: string) => void
  clearEditorSelection: () => void
  focusEditor: () => void
  insertWikiLinkAtCursor?: (target: { docKey: string; title?: string }) => boolean
  /** Append an outbound wiki link from source note to target (graph drag-to-link). */
  appendWikiLinkBetweenNotes?: (args: {
    sourceDocKey: string
    targetDocKey: string
    targetTitle?: string
  }) => Promise<boolean> | boolean
  removeWikiLinkBetweenNotes?: (args: {
    sourceDocKey: string
    targetDocKey: string
    heading?: string
    kind?: 'link' | 'embed'
    start?: number
    end?: number
  }) => Promise<boolean> | boolean
  onHoverIdChange: (id: string | null) => void
  openSearchModal: () => void
  /** After the document is opened: wait for editor ready → resolve anchor → reveal (disable restore overwriting).*/
  revealNavigationAnchor?: (request: EditorAnchorRevealRequest) => void | Promise<void>
  /** Merge frontmatter into disk for the given docKey (visual body stays in the editor). */
  updateDocumentFrontmatter?: (
    docKey: string,
    updater: (current: Record<string, unknown>) => Record<string, unknown>,
  ) => Promise<boolean>
}

let host: KnowledgeInteractionHost | null = null

export function registerKnowledgeInteractionHost(next: KnowledgeInteractionHost | null): void {
  host = next
}

export function getKnowledgeInteractionHost(): KnowledgeInteractionHost | null {
  return host
}
