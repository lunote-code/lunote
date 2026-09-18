import { useCallback, useSyncExternalStore } from 'react'

import { Icon } from '../../design-system/icons'
import type { TranslateFn } from '../../i18n'
import {
  isEditorBlockAiRunning,
  stopEditorBlockAi,
  subscribeEditorBlockAi,
} from '../../editor/ai/editorBlockAiRunner'

type Props = {
  t: TranslateFn
  className?: string
}

export function EditorBlockAiStatusChip({
  t,
  className = 'editor-block-ai-status-chip',
}: Props) {
  const running = useSyncExternalStore(
    subscribeEditorBlockAi,
    isEditorBlockAiRunning,
    isEditorBlockAiRunning,
  )

  const handleStop = useCallback(() => {
    stopEditorBlockAi()
  }, [])

  if (!running) return null

  const stopLabel = t('ai.rail.stop')

  return (
    <span
      className={className}
      data-testid="editor-block-ai-status"
      aria-live="polite"
      aria-busy="true"
    >
      <Icon
        name="refresh"
        size="xs"
        tone="muted"
        className="editor-block-ai-status-icon"
      />
      <span className="editor-block-ai-status-label">{t('ai.editor.blockAi.working')}</span>
      <button
        type="button"
        className="editor-block-ai-status-stop"
        onMouseDown={(event) => {
          event.preventDefault()
        }}
        onClick={handleStop}
        data-testid="editor-block-ai-cancel-button"
        aria-label={stopLabel}
      >
        {stopLabel}
      </button>
    </span>
  )
}
