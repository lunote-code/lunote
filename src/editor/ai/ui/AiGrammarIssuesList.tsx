import { useCallback, useState } from 'react'
import { Icon } from '../../../design-system/icons'
import { bridgeFindAndSelectText } from '../../editorMutationBridge'
import { preserveAiRailScrollDuring } from './aiRailScrollPreserve'
import { applyGrammarIssueFix } from '../grammar/applyGrammarIssueFix'
import type { AiGrammarIssue } from '../grammar/grammarCheckTypes'
import './aiGrammarIssues.css'

type Props = {
  issues: readonly AiGrammarIssue[]
  emptyLabel: string
  countLabel: (count: number) => string
  locateLabel: string
  applyLabel: string
  ignoreLabel: string
  appliedLabel: string
  locateFailedLabel: string
  applyFailedLabel: string
  onApplied?: () => void
}

export function AiGrammarIssuesList({
  issues,
  emptyLabel,
  countLabel,
  locateLabel,
  applyLabel,
  ignoreLabel,
  appliedLabel,
  locateFailedLabel,
  applyFailedLabel,
  onApplied,
}: Props) {
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(() => new Set())
  const [feedback, setFeedback] = useState<string | null>(null)

  const visibleIssues = issues.filter((issue) => !resolvedIds.has(issue.id))

  const dismissFeedback = useCallback(() => {
    window.setTimeout(() => setFeedback(null), 2400)
  }, [])

  const handleLocate = useCallback(
    (issue: AiGrammarIssue) => {
      preserveAiRailScrollDuring(() => {
        const ok = bridgeFindAndSelectText(issue.original)
        setFeedback(ok ? null : locateFailedLabel)
        if (!ok) dismissFeedback()
      })
    },
    [dismissFeedback, locateFailedLabel],
  )

  const handleApply = useCallback(
    (issue: AiGrammarIssue) => {
      preserveAiRailScrollDuring(() => {
        const ok = applyGrammarIssueFix(issue.original, issue.suggestion)
        if (!ok) {
          setFeedback(applyFailedLabel)
          dismissFeedback()
          return
        }
        setResolvedIds((current) => new Set(current).add(issue.id))
        setFeedback(appliedLabel)
        dismissFeedback()
        onApplied?.()
      })
    },
    [appliedLabel, applyFailedLabel, dismissFeedback, onApplied],
  )

  const handleIgnore = useCallback((issueId: string) => {
    setResolvedIds((current) => new Set(current).add(issueId))
  }, [])

  if (issues.length === 0) {
    return (
      <p className="ai-grammar-issues-empty" data-testid="ai-grammar-issues-empty">
        {emptyLabel}
      </p>
    )
  }

  return (
    <div className="ai-grammar-issues" data-testid="ai-grammar-issues">
      <p className="ai-grammar-issues-summary">{countLabel(visibleIssues.length)}</p>
      {feedback ? <p className="ai-grammar-issues-feedback">{feedback}</p> : null}
      <ul className="ai-grammar-issues-list">
        {issues.map((issue) => {
          const resolved = resolvedIds.has(issue.id)
          return (
            <li
              key={issue.id}
              className={`ai-grammar-issue${resolved ? ' ai-grammar-issue--resolved' : ''}`}
              data-testid={`ai-grammar-issue-${issue.id}`}
              data-resolved={resolved ? 'true' : 'false'}
            >
              <div className="ai-grammar-issue-body">
                <p className="ai-grammar-issue-original">{issue.original}</p>
                <p className="ai-grammar-issue-suggestion">{issue.suggestion}</p>
                {issue.reason ? (
                  <p className="ai-grammar-issue-reason">{issue.reason}</p>
                ) : null}
              </div>
              {resolved ? (
                <span className="ai-grammar-issue-status">{appliedLabel}</span>
              ) : (
                <div className="ai-grammar-issue-actions">
                  <button
                    type="button"
                    className="ai-grammar-issue-action"
                    onClick={() => handleLocate(issue)}
                    data-testid={`ai-grammar-issue-locate-${issue.id}`}
                  >
                    <Icon name="search" size="sm" tone="muted" />
                    {locateLabel}
                  </button>
                  <button
                    type="button"
                    className="ai-grammar-issue-action ai-grammar-issue-action--primary"
                    onClick={() => handleApply(issue)}
                    data-testid={`ai-grammar-issue-apply-${issue.id}`}
                  >
                    {applyLabel}
                  </button>
                  <button
                    type="button"
                    className="ai-grammar-issue-action"
                    onClick={() => handleIgnore(issue.id)}
                    data-testid={`ai-grammar-issue-ignore-${issue.id}`}
                  >
                    {ignoreLabel}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {issues.length > 0 && visibleIssues.length === 0 ? (
        <p className="ai-grammar-issues-empty">{emptyLabel}</p>
      ) : null}
    </div>
  )
}
