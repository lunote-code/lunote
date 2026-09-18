import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { Icon } from '../../../design-system/icons'
import {
  preserveAiRailScrollDuring,
  scheduleAiRailScrollRestoreAfterSideEffects,
  syncAiRailScrollSnapshot,
} from './aiRailScrollPreserve'
import { applyAiMentionSelection, useAiMentionState } from './aiMentionPicker'

type Props = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  disabled: boolean
  canSend: boolean
  isStreaming: boolean
  placeholder: string
  sendLabel: string
  stopLabel: string
  excludeDocKey?: string | null
  mentionEmptyLabel: string
}

function isNativeEditingShortcut(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return false
  const key = event.key.toLowerCase()
  return key === 'a' || key === 'c' || key === 'x' || key === 'v'
}

export function AiChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  disabled,
  canSend,
  isStreaming,
  placeholder,
  sendLabel,
  stopLabel,
  excludeDocKey = null,
  mentionEmptyLabel,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [caret, setCaret] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const mention = useAiMentionState(value, caret, excludeDocKey)

  useEffect(() => {
    setActiveIndex(0)
  }, [mention.active, mention.query, mention.candidates.length])

  useEffect(() => {
    const node = inputRef.current
    if (!node || disabled) return
    preserveAiRailScrollDuring(() => {
      node.focus({ preventScroll: true })
    })
  }, [disabled])

  const syncCaret = useCallback(() => {
    const node = inputRef.current
    if (!node) return
    setCaret(node.selectionStart ?? 0)
  }, [])

  const handleInputMouseDown = useCallback((event: MouseEvent<HTMLTextAreaElement>) => {
    if (event.currentTarget === document.activeElement) return
    event.preventDefault()
    preserveAiRailScrollDuring(() => {
      event.currentTarget.focus({ preventScroll: true })
    })
  }, [])

  const handleInputFocus = useCallback((event: FocusEvent<HTMLTextAreaElement>) => {
    if (event.currentTarget !== document.activeElement) return
    preserveAiRailScrollDuring(() => {})
    syncCaret()
  }, [syncCaret])

  const handleInputBlur = useCallback(() => {
    syncAiRailScrollSnapshot()
  }, [])

  const handleSend = useCallback(() => {
    onSend()
  }, [onSend])

  const applyMention = useCallback(
    (insertText: string) => {
      if (!mention.active) return
      const { nextText, nextCaret } = applyAiMentionSelection(value, mention.start, caret, insertText)
      onChange(nextText)
      window.requestAnimationFrame(() => {
        const node = inputRef.current
        if (!node) return
        node.focus({ preventScroll: true })
        node.setSelectionRange(nextCaret, nextCaret)
        setCaret(nextCaret)
      })
    },
    [caret, mention.active, mention.start, onChange, value],
  )

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (mention.active && mention.candidates.length > 0) {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setActiveIndex((index) => (index + 1) % mention.candidates.length)
          return
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setActiveIndex((index) => (index - 1 + mention.candidates.length) % mention.candidates.length)
          return
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault()
          const candidate = mention.candidates[activeIndex]
          if (candidate) applyMention(candidate.insertText)
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          return
        }
      }

      if (isNativeEditingShortcut(event)) {
        event.stopPropagation()
        preserveAiRailScrollDuring(() => {
          if (event.key.toLowerCase() === 'a') {
            event.preventDefault()
            event.currentTarget.select()
          }
        })
        scheduleAiRailScrollRestoreAfterSideEffects()
        return
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        if (canSend) handleSend()
      }
    },
    [activeIndex, applyMention, canSend, handleSend, mention.active, mention.candidates],
  )

  return (
    <div className="ai-rail-composer" data-testid="ai-chat-composer">
      <div className="ai-rail-input-shell">
        {mention.active ? (
          <div className="ai-rail-mention-picker" data-testid="ai-mention-picker">
            {mention.candidates.length > 0 ? (
              mention.candidates.map((candidate, index) => (
                <button
                  key={candidate.docKey}
                  type="button"
                  className={`ai-rail-mention-option${index === activeIndex ? ' is-active' : ''}`}
                  data-testid="ai-mention-option"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    applyMention(candidate.insertText)
                  }}
                >
                  <span className="ai-rail-mention-option-title">{candidate.title}</span>
                  <span className="ai-rail-mention-option-hint">{candidate.hint}</span>
                </button>
              ))
            ) : (
              <div className="ai-rail-mention-empty" data-testid="ai-mention-empty">
                {mentionEmptyLabel}
              </div>
            )}
          </div>
        ) : null}
        <textarea
          ref={inputRef}
          className="ai-rail-input"
          data-testid="ai-chat-input"
          value={value}
          onMouseDown={handleInputMouseDown}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onClick={syncCaret}
          onKeyUp={syncCaret}
          onSelect={syncCaret}
          onChange={(event) => {
            onChange(event.target.value)
            setCaret(event.target.selectionStart ?? 0)
          }}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          rows={3}
          aria-label={placeholder}
          disabled={disabled || isStreaming}
        />
        {isStreaming ? (
          <button
            type="button"
            className="ai-rail-composer-action ai-rail-composer-action--stop"
            onClick={onStop}
            aria-label={stopLabel}
            title={stopLabel}
            data-testid="ai-chat-stop-button"
          >
            <Icon name="stop" size="sm" tone="default" />
          </button>
        ) : (
          <button
            type="button"
            className="ai-rail-composer-action ai-rail-composer-action--send"
            disabled={!canSend || disabled}
            onClick={handleSend}
            aria-label={sendLabel}
            title={sendLabel}
            data-testid="ai-chat-send-button"
          >
            <Icon name="send" size="sm" tone={canSend && !disabled ? 'accent' : 'muted'} />
          </button>
        )}
      </div>
    </div>
  )
}
