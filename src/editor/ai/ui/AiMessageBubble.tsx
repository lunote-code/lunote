import { useCallback, useMemo, useState, type MouseEvent } from 'react'
import { Icon } from '../../../design-system/icons'
import { preserveBridgeEditorScrollDuring } from '../../editorMutationBridge'
import {
  asMetadataResolvedTarget,
  dispatchKnowledgeNavigate,
} from '../../knowledgeOS/ui/interactionTransaction'
import type { AiChatMessage } from '../aiChatTypes'
import type { AiQuickActionId } from '../actions/aiQuickActions'
import { applyAssistantFrontmatter } from '../actions/applyAssistantFrontmatter'
import { insertAssistantText } from '../actions/insertAssistantText'
import { saveAssistantToNewNote } from '../actions/saveAssistantToNewNote'
import { preserveAiRailScrollDuring, syncAiRailScrollSnapshot } from './aiRailScrollPreserve'
import {
  resolveAiAssistantMarkdownLinkTarget,
  resolveAiAssistantWikiLinkTarget,
} from './resolveAiAssistantLinkTarget'
import { renderAiAssistantMarkdown } from '../render/renderAiAssistantMarkdown'
import { AiGrammarIssuesList } from './AiGrammarIssuesList'

type Props = {
  message: AiChatMessage
  docKey: string | null
  insertLabel: string
  replaceLabel: string
  applyToPropertiesLabel: string
  copyLabel: string
  copiedLabel: string
  regenerateLabel: string
  saveToNewNoteLabel: string
  saveToNewNoteStem: string
  thinkingLabel: string
  userAvatarLabel: string
  assistantAvatarLabel: string
  showCopy: boolean
  showActions: boolean
  isPending: boolean
  canReplaceSelection: boolean
  onInserted?: () => void
  onInsertFailed?: () => void
  onReplaceFailed?: () => void
  onAppliedToProperties?: () => void
  onApplyToPropertiesFailed?: () => void
  onSaveToNewNoteResult?: (ok: boolean) => void
  onRegenerate?: (messageId: string) => void
  onReplaceMessage?: (content: string, actionId?: AiQuickActionId) => void
  grammarEmptyLabel?: string
  grammarCountLabel?: (count: number) => string
  grammarLocateLabel?: string
  grammarApplyLabel?: string
  grammarIgnoreLabel?: string
  grammarAppliedLabel?: string
  grammarLocateFailedLabel?: string
  grammarApplyFailedLabel?: string
  grammarParseFailedLabel?: string
  onGrammarApplied?: () => void
}

export function AiMessageBubble({
  message,
  docKey,
  insertLabel,
  replaceLabel,
  applyToPropertiesLabel,
  copyLabel,
  copiedLabel,
  thinkingLabel,
  userAvatarLabel,
  assistantAvatarLabel,
  showCopy,
  showActions,
  isPending,
  canReplaceSelection,
  onInserted,
  onInsertFailed,
  onReplaceFailed,
  onAppliedToProperties,
  onApplyToPropertiesFailed,
  onSaveToNewNoteResult,
  onRegenerate,
  onReplaceMessage,
  grammarEmptyLabel = '',
  grammarCountLabel = (count) => String(count),
  grammarLocateLabel = '',
  grammarApplyLabel = '',
  grammarIgnoreLabel = '',
  grammarAppliedLabel = '',
  grammarLocateFailedLabel = '',
  grammarApplyFailedLabel = '',
  grammarParseFailedLabel = '',
  onGrammarApplied,
  regenerateLabel,
  saveToNewNoteLabel,
  saveToNewNoteStem,
}: Props) {
  const [copied, setCopied] = useState(false)
  const [savingToNote, setSavingToNewNote] = useState(false)
  const [applyingFrontmatter, setApplyingFrontmatter] = useState(false)
  const isFrontmatterReply = message.autoApply === 'frontmatter'
  const isGrammarReply =
    message.role === 'assistant' && message.actionId === 'grammar-check' && !isPending
  const showGrammarIssues = isGrammarReply && Array.isArray(message.grammarIssues)
  const showGrammarParseFailed = isGrammarReply && message.grammarIssuesFailed === true
  const assistantHtml = useMemo(
    () =>
      message.role === 'assistant' && !isPending && !showGrammarIssues && !showGrammarParseFailed
        ? renderAiAssistantMarkdown(message.content)
        : '',
    [isPending, message.content, message.role, showGrammarIssues, showGrammarParseFailed],
  )

  const handleActionMouseDown = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    syncAiRailScrollSnapshot()
  }, [])

  const handleApplyToProperties = () => {
    if (applyingFrontmatter) return
    preserveAiRailScrollDuring(() => {
      setApplyingFrontmatter(true)
      void applyAssistantFrontmatter(message.content, docKey)
        .then((ok) => {
          if (ok) {
            onAppliedToProperties?.()
            return
          }
          onApplyToPropertiesFailed?.()
        })
        .finally(() => {
          preserveAiRailScrollDuring(() => setApplyingFrontmatter(false))
        })
    })
  }

  const handleInsert = () => {
    preserveAiRailScrollDuring(() => {
      if (!insertAssistantText(message.content, 'insert')) {
        onInsertFailed?.()
        return
      }
      onInserted?.()
    })
  }

  const handleReplace = () => {
    preserveAiRailScrollDuring(() => {
      if (onReplaceMessage) {
        onReplaceMessage(message.content, message.actionId)
        return
      }
      if (!insertAssistantText(message.content, 'replace')) {
        onReplaceFailed?.()
        return
      }
      onInserted?.()
    })
  }

  const handleCopy = () => {
    preserveAiRailScrollDuring(() => {
      preserveBridgeEditorScrollDuring(() => {
        void navigator.clipboard.writeText(message.content).then(() => {
          preserveAiRailScrollDuring(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1600)
          })
        })
      })
    })
  }

  const handleRegenerate = () => {
    preserveAiRailScrollDuring(() => {
      onRegenerate?.(message.id)
    })
  }

  const handleWikiLinkClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest('a')
    if (!anchor) return

    const href = anchor.getAttribute('href') ?? ''
    if (/^https?:/iu.test(href)) {
      event.preventDefault()
      return
    }

    const encoded = anchor.getAttribute('data-wiki-target')
    const linkText = anchor.textContent?.trim() ?? ''
    const isWikiLink = anchor.classList.contains('ai-wiki-link') || Boolean(encoded)
    const target = isWikiLink
      ? resolveAiAssistantWikiLinkTarget(encoded, linkText)
      : resolveAiAssistantMarkdownLinkTarget(anchor.getAttribute('href') ?? '', linkText, docKey)

    if (!target) return

    if (!isWikiLink && (!href || href === '#')) return

    event.preventDefault()
    preserveAiRailScrollDuring(() => {
      dispatchKnowledgeNavigate('wiki', asMetadataResolvedTarget(target, 'compiler'))
    })
  }, [docKey])

  const handleSaveToNewNote = () => {
    if (savingToNote) return
    preserveAiRailScrollDuring(() => {
      setSavingToNewNote(true)
      void saveAssistantToNewNote(message.content, saveToNewNoteStem)
        .then((ok) => {
          onSaveToNewNoteResult?.(ok)
        })
        .finally(() => {
        preserveAiRailScrollDuring(() => setSavingToNewNote(false))
      })
    })
  }

  const copyButtonLabel = copied ? copiedLabel : copyLabel
  const avatarLabel = message.role === 'user' ? userAvatarLabel : assistantAvatarLabel

  return (
    <div
      className={`ai-rail-message ai-rail-message--${message.role}${isPending ? ' ai-rail-message--pending' : ''}`}
      data-testid={`ai-chat-message-${message.role}`}
    >
      <div
        className={`ai-rail-message-avatar ai-rail-message-avatar--${message.role}`}
        role="img"
        aria-label={avatarLabel}
        title={avatarLabel}
      >
        <Icon name={message.role === 'user' ? 'user' : 'ai'} size="sm" tone="default" />
      </div>
      <div className="ai-rail-message-body">
        {message.role === 'assistant' ? (
          <div
            className={`ai-rail-message-content ai-rail-message-content--markdown markdown-body${isPending ? ' ai-rail-message-content--pending' : ''}`}
            aria-busy={isPending}
            data-testid={isPending ? 'ai-chat-message-pending' : undefined}
          >
            {isPending ? (
              <span className="ai-rail-typing-indicator" aria-label={thinkingLabel}>
                <span className="ai-rail-typing-dot" aria-hidden="true" />
                <span className="ai-rail-typing-dot" aria-hidden="true" />
                <span className="ai-rail-typing-dot" aria-hidden="true" />
              </span>
            ) : showGrammarIssues ? (
              <AiGrammarIssuesList
                issues={message.grammarIssues ?? []}
                emptyLabel={grammarEmptyLabel}
                countLabel={grammarCountLabel}
                locateLabel={grammarLocateLabel}
                applyLabel={grammarApplyLabel}
                ignoreLabel={grammarIgnoreLabel}
                appliedLabel={grammarAppliedLabel}
                locateFailedLabel={grammarLocateFailedLabel}
                applyFailedLabel={grammarApplyFailedLabel}
                onApplied={onGrammarApplied}
              />
            ) : showGrammarParseFailed ? (
              <div className="ai-grammar-issues-parse-failed" data-testid="ai-grammar-issues-parse-failed">
                <p>{grammarParseFailedLabel}</p>
                <pre className="ai-grammar-issues-raw">{message.content}</pre>
              </div>
            ) : (
              <div
                dangerouslySetInnerHTML={{ __html: assistantHtml || '<p></p>' }}
                onClick={handleWikiLinkClick}
              />
            )}
          </div>
        ) : (
          <div className="ai-rail-message-content">{message.content}</div>
        )}
        {showCopy || showActions ? (
          <div className="ai-rail-message-actions">
            {showCopy ? (
              <button
                type="button"
                className="ai-rail-message-action ai-rail-message-action--icon"
                onMouseDown={handleActionMouseDown}
                onClick={handleCopy}
                aria-label={copyButtonLabel}
                title={copyButtonLabel}
                data-testid="ai-message-copy-button"
              >
                <Icon
                  name={copied ? 'callout-success' : 'copy'}
                  size="sm"
                  tone={copied ? 'accent' : 'muted'}
                />
              </button>
            ) : null}
            {showActions && !isGrammarReply ? (
              <>
                <button
                  type="button"
                  className="ai-rail-message-action ai-rail-message-action--icon"
                  onMouseDown={handleActionMouseDown}
                  onClick={handleRegenerate}
                  aria-label={regenerateLabel}
                  title={regenerateLabel}
                  data-testid="ai-message-regenerate-button"
                >
                  <Icon name="refresh" size="sm" tone="muted" />
                </button>
                <button
                  type="button"
                  className="ai-rail-message-action ai-rail-message-action--icon"
                  onMouseDown={handleActionMouseDown}
                  onClick={handleSaveToNewNote}
                  disabled={savingToNote}
                  aria-label={saveToNewNoteLabel}
                  title={saveToNewNoteLabel}
                  data-testid="ai-message-save-to-note-button"
                >
                  <Icon name="note-new" size="sm" tone="muted" />
                </button>
                {isFrontmatterReply ? (
                  <button
                    type="button"
                    className="ai-rail-message-action ai-rail-message-action--icon"
                    onMouseDown={handleActionMouseDown}
                    onClick={handleApplyToProperties}
                    disabled={applyingFrontmatter}
                    aria-label={applyToPropertiesLabel}
                    title={applyToPropertiesLabel}
                    data-testid="ai-message-apply-frontmatter-button"
                  >
                    <Icon name="frontmatter" size="sm" tone="muted" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ai-rail-message-action ai-rail-message-action--icon"
                    onMouseDown={handleActionMouseDown}
                    onClick={handleInsert}
                    aria-label={insertLabel}
                    title={insertLabel}
                    data-testid="ai-message-insert-button"
                  >
                    <Icon name="tab-new" size="sm" tone="muted" />
                  </button>
                )}
                {canReplaceSelection && !isFrontmatterReply ? (
                  <button
                    type="button"
                    className="ai-rail-message-action ai-rail-message-action--icon"
                    onMouseDown={handleActionMouseDown}
                    onClick={handleReplace}
                    aria-label={replaceLabel}
                    title={replaceLabel}
                    data-testid="ai-message-replace-button"
                  >
                    <Icon name="editor" size="sm" tone="muted" />
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
