import { useCallback, useSyncExternalStore } from 'react'

import type { TranslateFn } from '../../i18n'
import {
  getEditorAiInsertUndoDocId,
  subscribeEditorAiInsertFeedback,
} from '../../editor/ai/editorAiInsertFeedback'
import { performEditorAiInsertUndo } from '../../editor/ai/actions/insertAssistantText'

type Props = {
  t: TranslateFn
  activePath: string | null
  className?: string
}

export function EditorAiInsertUndoChip({ t, activePath, className = 'editor-ai-insert-undo-btn' }: Props) {
  const pendingDocId = useSyncExternalStore(
    subscribeEditorAiInsertFeedback,
    getEditorAiInsertUndoDocId,
    getEditorAiInsertUndoDocId,
  )

  const handleUndo = useCallback(() => {
    performEditorAiInsertUndo(pendingDocId)
  }, [pendingDocId])

  if (!pendingDocId || !activePath || pendingDocId !== activePath) return null

  const label = t('ai.rail.undoInsert')

  return (
    <button
      type="button"
      className={className}
      onMouseDown={(event) => {
        event.preventDefault()
      }}
      onClick={handleUndo}
      data-testid="editor-ai-insert-undo-button"
      aria-label={label}
    >
      {label}
    </button>
  )
}
