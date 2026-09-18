type ContextPart = {
  key: string
  text: string
  pending?: boolean
  warning?: boolean
  tooltip?: string
}

type Props = {
  hasNoteContext: boolean
  workspaceSearchCount: number
  graphNeighborCount: number
  workspaceSearchPending: boolean
  graphNeighborsPending: boolean
  workspaceSearchFailed?: boolean
  workspaceSearchMissed?: boolean
  graphNeighborsFailed?: boolean
  graphNeighborsMissed?: boolean
  referencedNoteCount?: number
  noteLabel: string
  workspaceSearchLabel: (count: number) => string
  workspaceSearchPendingLabel: string
  workspaceSearchPendingTooltip: string
  workspaceSearchFailedLabel: string
  workspaceSearchFailedTooltip: string
  workspaceSearchMissedLabel: string
  workspaceSearchMissedTooltip: string
  graphNeighborsLabel: (count: number) => string
  graphNeighborsPendingLabel: string
  graphNeighborsPendingTooltip: string
  graphNeighborsFailedLabel: string
  graphNeighborsFailedTooltip: string
  graphNeighborsMissedLabel: string
  graphNeighborsMissedTooltip: string
  referencedNotesLabel?: (count: number) => string
}

export function AiContextChips({
  hasNoteContext,
  workspaceSearchCount,
  graphNeighborCount,
  workspaceSearchPending,
  graphNeighborsPending,
  workspaceSearchFailed = false,
  workspaceSearchMissed = false,
  graphNeighborsFailed = false,
  graphNeighborsMissed = false,
  referencedNoteCount = 0,
  noteLabel,
  workspaceSearchLabel,
  workspaceSearchPendingLabel,
  workspaceSearchPendingTooltip,
  workspaceSearchFailedLabel,
  workspaceSearchFailedTooltip,
  workspaceSearchMissedLabel,
  workspaceSearchMissedTooltip,
  graphNeighborsLabel,
  graphNeighborsPendingLabel,
  graphNeighborsPendingTooltip,
  graphNeighborsFailedLabel,
  graphNeighborsFailedTooltip,
  graphNeighborsMissedLabel,
  graphNeighborsMissedTooltip,
  referencedNotesLabel,
}: Props) {
  const parts: ContextPart[] = []

  if (hasNoteContext) {
    parts.push({ key: 'note', text: noteLabel })
  }
  if (referencedNoteCount > 0 && referencedNotesLabel) {
    parts.push({ key: 'referenced', text: referencedNotesLabel(referencedNoteCount) })
  }
  if (graphNeighborsFailed) {
    parts.push({
      key: 'graph-failed',
      text: graphNeighborsFailedLabel,
      warning: true,
      tooltip: graphNeighborsFailedTooltip,
    })
  } else if (graphNeighborsMissed) {
    parts.push({
      key: 'graph-missed',
      text: graphNeighborsMissedLabel,
      warning: true,
      tooltip: graphNeighborsMissedTooltip,
    })
  } else if (graphNeighborCount > 0) {
    parts.push({ key: 'graph', text: graphNeighborsLabel(graphNeighborCount) })
  } else if (graphNeighborsPending) {
    parts.push({
      key: 'graph-pending',
      text: graphNeighborsPendingLabel,
      pending: true,
      tooltip: graphNeighborsPendingTooltip,
    })
  }
  if (workspaceSearchFailed) {
    parts.push({
      key: 'workspace-failed',
      text: workspaceSearchFailedLabel,
      warning: true,
      tooltip: workspaceSearchFailedTooltip,
    })
  } else if (workspaceSearchMissed) {
    parts.push({
      key: 'workspace-missed',
      text: workspaceSearchMissedLabel,
      warning: true,
      tooltip: workspaceSearchMissedTooltip,
    })
  } else if (workspaceSearchCount > 0) {
    parts.push({ key: 'workspace', text: workspaceSearchLabel(workspaceSearchCount) })
  } else if (workspaceSearchPending) {
    parts.push({
      key: 'workspace-pending',
      text: workspaceSearchPendingLabel,
      pending: true,
      tooltip: workspaceSearchPendingTooltip,
    })
  }

  if (parts.length === 0) {
    return null
  }

  return (
    <div className="ai-rail-context-meta" data-testid="ai-context-chips">
      {parts.map((part, index) => (
        <span key={part.key} className="ai-rail-context-meta-item">
          {index > 0 ? (
            <span className="ai-rail-context-meta-sep" aria-hidden="true">
              ·
            </span>
          ) : null}
          <span
            className={`ai-rail-context-meta-part${
              part.pending ? ' ai-rail-context-meta-part--pending' : ''
            }${part.warning ? ' ai-rail-context-meta-part--warning' : ''}`}
            data-testid="ai-context-chip"
            title={part.tooltip}
          >
            {part.text}
          </span>
        </span>
      ))}
    </div>
  )
}
