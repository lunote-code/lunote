import type { AiQuickActionId } from '../actions/aiQuickActions'
import { AI_QUICK_ACTIONS } from '../actions/aiQuickActions'

type Props = {
  disabled: boolean
  configured: boolean
  configureFirstTitle: string
  hasNoteContext: boolean
  isStreaming: boolean
  labelFor: (key: string) => string
  onAction: (actionId: AiQuickActionId) => void
}

const WELCOME_ACTIONS = AI_QUICK_ACTIONS.filter((action) => action.welcomeOnly)

export function AiWelcomeActions({
  disabled,
  configured,
  configureFirstTitle,
  hasNoteContext,
  isStreaming,
  labelFor,
  onAction,
}: Props) {
  const blocked = disabled || isStreaming
  const visibleActions = WELCOME_ACTIONS.filter(
    (action) => !action.requiresNoteContext || hasNoteContext,
  )
  if (visibleActions.length === 0) return null

  return (
    <div className="ai-rail-welcome-actions" data-testid="ai-welcome-actions">
      {visibleActions.map((action) => {
        const title =
          blocked && !configured
            ? configureFirstTitle
            : action.hintKey
              ? labelFor(action.hintKey)
              : undefined
        return (
        <button
          key={action.id}
          type="button"
          className="ai-rail-welcome-action"
          disabled={blocked}
          title={title}
          onClick={() => onAction(action.id)}
          data-testid={`ai-welcome-action-${action.id}`}
        >
          {labelFor(action.labelKey)}
        </button>
        )
      })}
    </div>
  )
}
