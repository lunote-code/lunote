import type { Editor } from '@tiptap/core'

import { clearDocumentFocus } from '../documentRuntime'
import type { MermaidFlushReason } from './mermaidSourceBridge'
import { flushMermaidBlockSession, setActiveMermaidBlockId } from './mermaidSourceStore'

/**
 * Switch block: flush → clear inputFocusToken → synchronize UI active (logic does not depend on active state).
 */
export function switchMermaidActiveBlock(
  editor: Editor,
  nextBlockId: string | null,
  currentBlockId: string | null,
  reason: MermaidFlushReason = 'tab-switch',
  options?: { skipFlush?: boolean },
): void {
  clearDocumentFocus(editor)

  if (!options?.skipFlush && currentBlockId && currentBlockId !== nextBlockId) {
    flushMermaidBlockSession(editor, currentBlockId, reason)
  }

  setActiveMermaidBlockId(nextBlockId)
}
