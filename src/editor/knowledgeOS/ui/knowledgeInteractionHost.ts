import type { EditorAnchorRevealRequest } from '../editorAnchorNavigation'

/**
 * App Host Contract: The only injection point, dispersing interaction branches within the App is prohibited.
 */
export type KnowledgeInteractionHost = {
  getRootDir: () => string | null
  openAbsolutePath: (absolutePath: string) => void
  clearEditorSelection: () => void
  focusEditor: () => void
  onHoverIdChange: (id: string | null) => void
  openSearchModal: () => void
  /** After the document is opened: wait for editor ready → resolve anchor → reveal (disable restore overwriting).*/
  revealNavigationAnchor?: (request: EditorAnchorRevealRequest) => void | Promise<void>
}

let host: KnowledgeInteractionHost | null = null

export function registerKnowledgeInteractionHost(next: KnowledgeInteractionHost | null): void {
  host = next
}

export function getKnowledgeInteractionHost(): KnowledgeInteractionHost | null {
  return host
}
