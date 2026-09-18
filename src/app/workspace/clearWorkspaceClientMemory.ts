import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import { bumpFileStatGeneration } from '../../lib/fileStatGeneration'
import { clearTabBodies } from '../document/tabBodiesStore'
import { clearTabEditorSessions } from '../document/tabEditorSessionStore'
import { clearAllDocumentFrontmatter } from '../../editor/documentFrontmatterStore'
import { clearAllWorkspaceImageObjectUrls } from '../../export/workspaceMediaBlob'
import { clearAllHistoryRestoreState } from '../../documentHistory/historyRestoreState'
import { clearAllAiConversationMemory } from '../../editor/ai/persistence/aiConversationStore'
import { clearAllAiChatDrafts } from '../../editor/ai/hooks/aiChatDraftStore'
import { clearAllModeSwitchAnchors } from '../../editor/modeSwitchLastGoodAnchor'
import { clearSourceModeIdentity } from '../../editor/sourceModeIdentity'
import { clearWorkspaceIndexProgress } from './workspaceIndexProgressStore'

export type ClearWorkspaceClientMemoryOptions = {
  previousRoot?: string
  fileStatRef?: MutableRefObject<Record<string, { modifiedSecs: number; size: number }>>
  fileStatGenerationRef?: MutableRefObject<number>
  setBufferTabLabels?: Dispatch<SetStateAction<Record<string, string>>>
  /** Keep caret/scroll only. Positions are not document plaintext. */
  preserveTabEditorSessions?: boolean
}

/** Drop in-memory document caches when leaving a workspace. */
export function clearWorkspaceClientMemory(options: ClearWorkspaceClientMemoryOptions = {}): void {
  const { previousRoot, fileStatRef, fileStatGenerationRef, setBufferTabLabels } = options
  clearTabBodies()
  if (!options.preserveTabEditorSessions) {
    clearTabEditorSessions()
  }
  clearAllDocumentFrontmatter()
  clearAllWorkspaceImageObjectUrls()
  clearAllHistoryRestoreState()
  clearAllAiConversationMemory()
  clearAllAiChatDrafts()
  clearAllModeSwitchAnchors()
  clearSourceModeIdentity()
  if (previousRoot) {
    clearWorkspaceIndexProgress(previousRoot)
  }
  if (fileStatGenerationRef) {
    bumpFileStatGeneration(fileStatGenerationRef)
  }
  if (fileStatRef) {
    fileStatRef.current = {}
  }
  setBufferTabLabels?.({})
}
