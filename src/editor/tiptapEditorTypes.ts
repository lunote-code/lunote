import type { Editor } from '@tiptap/core'

import type { ModeSwitchSnapshot } from './modeSwitchSnapshot'
import type { SourceModeEnterAnchor } from './viewportModeAnchor'

/** Switching back to WYSIWYG from source: selection payload applied with the document within a single PM `tr`*/
export type AtomicVisualDocumentEnter = {
  readonly documentKey: string
  readonly pmAnchor: number
  readonly pmHead: number
  /** Restore the scroll bar ratio when switching back to the label (corresponding to getProseMirrorScrollRatio)*/
  readonly scrollRatio?: number
  /** Precise frozen restore payload produced by source→visual mode switch. */
  readonly modeSwitchSnapshot?: ModeSwitchSnapshot | null
}

export type TiptapEditorCommand =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6 }
  | { type: 'headingLevelDelta'; delta: -1 | 1 }
  | { type: 'callout'; kind: 'note' | 'tip' | 'important' | 'warning' | 'caution' }
  | { type: 'insertParagraphAbove' }
  | { type: 'insertParagraphBelow' }
  | { type: 'blockMath' }
  | { type: 'copyCodeBlock' }
  | { type: 'indentCodeSelection' }
  | { type: 'indentCodeBlock' }
  | { type: 'paragraph' }
  | { type: 'bulletList' }
  | { type: 'orderedList' }
  | { type: 'taskList' }
  | { type: 'blockquote' }
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'underline' }
  | { type: 'strike' }
  | { type: 'highlight' }
  | { type: 'code' }
  | { type: 'inlineMath' }
  | { type: 'comment' }
  | { type: 'setTextColor'; color: string | null }
  | { type: 'link' }
  | { type: 'openLink' }
  | { type: 'copyLinkAddress' }
  | { type: 'image' }
  | { type: 'insertTablePicker' }
  | { type: 'openEmojiPicker' }
  | { type: 'codeBlock'; language?: string }
  | { type: 'selectAll' }
  | { type: 'deleteSelection' }
  | { type: 'clearFormatting' }
  | { type: 'insertText'; text: string }
  | { type: 'horizontalRule' }
  | { type: 'tocDirective' }
  | { type: 'linkReference' }
  | { type: 'footnoteRef'; label?: string }

/**⌘/ Capture result: successful payload, or no-op abort (no entering source code, no snapshot writing)*/
export type CaptureVisualToSourceResult =
  | {
      ok: true
      markdown: string
      anchor: SourceModeEnterAnchor
      resultKind: 'strict_success' | 'degraded_success'
    }
  | { ok: false; reason: 'no_editor' }
  | { ok: false; reason: 'document_mismatch' }

export type PendingMarkdownSyncResult =
  | { ok: true; markdown: string }
  | { ok: false; error: unknown }

export type TiptapMarkdownEditorHandle = {
  /** Command parsing layer collection EditorContext / used to execute ephemeral*/
  getEditor: () => Editor | null
  /** The documentKey currently bound by PM (can be safely saved only when it is consistent with props.documentKey/⌘/)*/
  getBoundDocumentKey: () => string | null
  focus: () => void
  openSearchPanel: (options?: { replace?: boolean }) => boolean
  moveSearch: (direction: 1 | -1) => boolean
  replaceSearchNext: (replacement: string) => boolean
  /** Collapse selection before navigation without focus (responsible by IEM focusEditor tail)*/
  collapseSelectionForNavigation: () => void
  getMarkdown: (force?: boolean) => string
  tryFlushPendingMarkdownSync: () => PendingMarkdownSyncResult
  /** Cancel anti-shake and synchronize PM→Markdown, call before saving/cutting tabs */
  flushPendingMarkdownSync: (force?: boolean, emitChange?: boolean) => string
  /** Normalize a markdown string using the editor schema for compare-only. */
  normalizeMarkdownForCompare: (markdown: string) => string | null
  /** True only after an explicit user edit on the current document load (not hydrate/restore). */
  hasUserEditedSinceDocumentLoad: () => boolean
  /** Resolve after the IME combination input is completed and await before saving.*/
  waitForCompositionEnd: () => Promise<void>
  getActiveBlockType: () => string | null
  hasActiveLocalSourceIsland: () => boolean
  openSourceIslandForActiveBlock: () => boolean
  closeSourceIslandForActiveBlock: () => boolean
  getSelectedText: () => string
  getSelectedMarkdown: () => string
  deleteSelection: () => boolean
  replaceSelection: (text: string) => boolean
  runCommand: (command: TiptapEditorCommand) => boolean
  scrollToHeading: (id: string) => boolean
  revealNavigationAnchor: (request: {
    headingSlug?: string
    blockId?: string
    line?: number
  }) => Promise<boolean>
  /** ProseMirror root scrolling (consistent with .ProseMirror overflow-y)*/
  getProseMirrorScrollTop: () => number | null
  /** The ratio of the scroll bar position to the scrollable interval [0,1], used to align with containers of different heights such as CodeMirror*/
  getProseMirrorScrollRatio: () => number | null
  /** Disabled: History API, selections are handled by hierarchical mode switching pipeline*/
  applyMarkdownSelectionAndScroll: (cmAnchor: number, cmHead: number) => boolean
  /**
   * Command+/ Atomic capture: the same serialized string + Markdown selection offset + viewport anchor point to avoid inconsistency between two calls to getMarkdown and offsets.
   */
  captureVisualToSourceTransition: (documentKey: string) => CaptureVisualToSourceResult
  /** Navigation barrier: whether the PM is mounted and the anchor slug is positionable*/
  getNavigationHydrationStatus: (documentKey: string) => {
    editorMounted: boolean
    pmDocReady: boolean
    isHeadingSlugIndexed: (slug: string) => boolean
  }
}
