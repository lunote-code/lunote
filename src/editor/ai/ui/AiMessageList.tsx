import type { AiChatMessage } from '../aiChatTypes'
import { isDocumentReplaceAction } from '../actions/aiReplaceScope'
import type { AiQuickActionId } from '../actions/aiQuickActions'
import { AiMessageBubble } from './AiMessageBubble'

type Props = {
  messages: AiChatMessage[]
  docKey: string | null
  thinkingLabel: string
  isStreaming: boolean
  insertLabel: string
  replaceLabel: string
  replaceRestoredLabel: string
  applyToPropertiesLabel: string
  copyLabel: string
  copiedLabel: string
  regenerateLabel: string
  saveToNewNoteLabel: string
  saveToNewNoteStem: string
  undoInsertLabel?: string
  showInsertUndo?: boolean
  onUndoInsert?: () => void
  userAvatarLabel: string
  assistantAvatarLabel: string
  canReplaceSelection: boolean
  replaceUsesRestoredSelection: boolean
  onInserted: () => void
  onInsertFailed?: () => void
  onReplaceFailed?: () => void
  onAppliedToProperties: () => void
  onApplyToPropertiesFailed: () => void
  onSaveToNewNoteResult: (ok: boolean) => void
  onRegenerate: (messageId: string) => void
  onReplaceMessage: (content: string, actionId?: AiQuickActionId) => void
  grammarEmptyLabel: string
  grammarCountLabel: (count: number) => string
  grammarLocateLabel: string
  grammarApplyLabel: string
  grammarIgnoreLabel: string
  grammarAppliedLabel: string
  grammarLocateFailedLabel: string
  grammarApplyFailedLabel: string
  grammarParseFailedLabel: string
  onGrammarApplied: () => void
}

export function AiMessageList({
  messages,
  docKey,
  thinkingLabel,
  isStreaming,
  insertLabel,
  replaceLabel,
  replaceRestoredLabel,
  applyToPropertiesLabel,
  copyLabel,
  copiedLabel,
  regenerateLabel,
  saveToNewNoteLabel,
  saveToNewNoteStem,
  undoInsertLabel,
  showInsertUndo = false,
  onUndoInsert,
  userAvatarLabel,
  assistantAvatarLabel,
  canReplaceSelection,
  replaceUsesRestoredSelection,
  onInserted,
  onInsertFailed,
  onReplaceFailed,
  onAppliedToProperties,
  onApplyToPropertiesFailed,
  onSaveToNewNoteResult,
  onRegenerate,
  onReplaceMessage,
  grammarEmptyLabel,
  grammarCountLabel,
  grammarLocateLabel,
  grammarApplyLabel,
  grammarIgnoreLabel,
  grammarAppliedLabel,
  grammarLocateFailedLabel,
  grammarApplyFailedLabel,
  grammarParseFailedLabel,
  onGrammarApplied,
}: Props) {
  if (messages.length === 0 && !isStreaming) {
    return null
  }

  const lastMessage = messages[messages.length - 1]
  const insertUndoMessageId = showInsertUndo
    ? [...messages].reverse().find(
        (message) => message.role === 'assistant' && message.content.trim().length > 0,
      )?.id ?? null
    : null

  return (
    <div className="ai-rail-message-list" data-testid="ai-chat-message-list">
      {messages.map((message) => {
        const isPending =
          isStreaming &&
          message.role === 'assistant' &&
          message.id === lastMessage?.id &&
          message.content.trim().length === 0
        const isStreamingAssistant =
          isStreaming &&
          message.role === 'assistant' &&
          message.id === lastMessage?.id

        return (
          <div key={message.id}>
            <AiMessageBubble
              message={message}
              docKey={docKey}
              insertLabel={insertLabel}
              applyToPropertiesLabel={applyToPropertiesLabel}
              copyLabel={copyLabel}
              copiedLabel={copiedLabel}
              regenerateLabel={regenerateLabel}
              saveToNewNoteLabel={saveToNewNoteLabel}
              saveToNewNoteStem={saveToNewNoteStem}
              userAvatarLabel={userAvatarLabel}
              assistantAvatarLabel={assistantAvatarLabel}
              thinkingLabel={thinkingLabel}
              showCopy={
                message.content.trim().length > 0 &&
                (message.role === 'user' || (message.role === 'assistant' && !isPending))
              }
              showActions={
                message.role === 'assistant' &&
                message.content.trim().length > 0 &&
                !isPending &&
                !isStreamingAssistant
              }
              isPending={isPending}
              canReplaceSelection={
                canReplaceSelection || isDocumentReplaceAction(message.actionId)
              }
              replaceLabel={
                replaceUsesRestoredSelection && canReplaceSelection
                  ? replaceRestoredLabel
                  : replaceLabel
              }
              onInserted={onInserted}
              onInsertFailed={onInsertFailed}
              onReplaceFailed={onReplaceFailed}
              onAppliedToProperties={onAppliedToProperties}
              onApplyToPropertiesFailed={onApplyToPropertiesFailed}
              onSaveToNewNoteResult={onSaveToNewNoteResult}
              onRegenerate={onRegenerate}
              onReplaceMessage={onReplaceMessage}
              grammarEmptyLabel={grammarEmptyLabel}
              grammarCountLabel={grammarCountLabel}
              grammarLocateLabel={grammarLocateLabel}
              grammarApplyLabel={grammarApplyLabel}
              grammarIgnoreLabel={grammarIgnoreLabel}
              grammarAppliedLabel={grammarAppliedLabel}
              grammarLocateFailedLabel={grammarLocateFailedLabel}
              grammarApplyFailedLabel={grammarApplyFailedLabel}
              grammarParseFailedLabel={grammarParseFailedLabel}
              onGrammarApplied={onGrammarApplied}
            />
            {insertUndoMessageId === message.id && undoInsertLabel ? (
              <div
                className="ai-rail-insert-notice"
                role="group"
                aria-label={undoInsertLabel}
              >
                <button
                  type="button"
                  className="ai-rail-insert-undo"
                  onClick={onUndoInsert}
                  data-testid="ai-insert-undo-button"
                >
                  {undoInsertLabel}
                </button>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
