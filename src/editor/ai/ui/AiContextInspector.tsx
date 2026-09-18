import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  asMetadataResolvedTarget,
  dispatchKnowledgeNavigate,
} from '../../knowledgeOS/ui/interactionTransaction'
import { useFocusTrap } from '../../../lib/useFocusTrap'
import type { AiContextInspectorNote, AiContextInspectorSnapshot } from '../hooks/useAiChat'
import { AiContextChips } from './AiContextChips'

type Props = {
  snapshot: AiContextInspectorSnapshot
  hasNoteContext: boolean
  workspaceSearchCount: number
  graphNeighborCount: number
  workspaceSearchPending: boolean
  graphNeighborsPending: boolean
  workspaceSearchFailed: boolean
  workspaceSearchMissed: boolean
  graphNeighborsFailed: boolean
  graphNeighborsMissed: boolean
  referencedNoteCount: number
  noteLabel: string
  workspaceSearchLabel: (count: number) => string
  workspaceSearchPendingLabel: string
  workspaceSearchPendingTooltip: string
  workspaceSearchPendingInspectorLabel: string
  workspaceSearchFailedLabel: string
  workspaceSearchFailedTooltip: string
  workspaceSearchFailedInspectorLabel: string
  workspaceSearchMissedLabel: string
  workspaceSearchMissedTooltip: string
  workspaceSearchMissedInspectorLabel: string
  graphNeighborsLabel: (count: number) => string
  graphNeighborsPendingLabel: string
  graphNeighborsPendingTooltip: string
  graphNeighborsFailedLabel: string
  graphNeighborsFailedTooltip: string
  graphNeighborsFailedInspectorLabel: string
  graphNeighborsMissedLabel: string
  graphNeighborsMissedTooltip: string
  graphNeighborsMissedInspectorLabel: string
  referencedNotesLabel: (count: number) => string
  inspectorTitle: string
  noteSectionLabel: string
  selectionSectionLabel: string
  workspaceSectionLabel: string
  graphSectionLabel: string
  referencedSectionLabel: string
  emptyLabel: string
  closeLabel: string
}

function truncatePreview(text: string | null, maxChars: number): string | null {
  if (!text?.trim()) return null
  const trimmed = text.trim()
  if (trimmed.length <= maxChars) return trimmed
  return `${trimmed.slice(0, maxChars).trimEnd()}…`
}

function NoteEntryList({
  notes,
  emptyLabel,
}: {
  notes: readonly AiContextInspectorNote[]
  emptyLabel: string
}) {
  const openNote = useCallback((docKey: string) => {
    dispatchKnowledgeNavigate('wiki', asMetadataResolvedTarget({ docKey }, 'compiler'))
  }, [])

  if (notes.length === 0) {
    return <p className="ai-rail-context-inspector-empty">{emptyLabel}</p>
  }

  return (
    <ul className="ai-rail-context-inspector-list">
      {notes.map((note) => {
        const preview = truncatePreview(note.snippet ?? null, 240)
        return (
          <li key={note.docKey} className="ai-rail-context-inspector-entry">
            <button
              type="button"
              className="ai-rail-context-inspector-link"
              data-testid={`ai-context-inspector-link-${note.docKey}`}
              onClick={() => openNote(note.docKey)}
            >
              {note.title}
            </button>
            {preview ? (
              <pre className="ai-rail-context-inspector-preview ai-rail-context-inspector-snippet">
                {preview}
              </pre>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function InspectorStatusNote({ label }: { label: string }) {
  return <p className="ai-rail-context-inspector-empty ai-rail-context-inspector-status">{label}</p>
}

export function AiContextInspector({
  snapshot,
  hasNoteContext,
  workspaceSearchCount,
  graphNeighborCount,
  workspaceSearchPending,
  graphNeighborsPending,
  workspaceSearchFailed,
  workspaceSearchMissed,
  graphNeighborsFailed,
  graphNeighborsMissed,
  referencedNoteCount,
  noteLabel,
  workspaceSearchLabel,
  workspaceSearchPendingLabel,
  workspaceSearchPendingTooltip,
  workspaceSearchPendingInspectorLabel,
  workspaceSearchFailedLabel,
  workspaceSearchFailedTooltip,
  workspaceSearchFailedInspectorLabel,
  workspaceSearchMissedLabel,
  workspaceSearchMissedTooltip,
  workspaceSearchMissedInspectorLabel,
  graphNeighborsLabel,
  graphNeighborsPendingLabel,
  graphNeighborsPendingTooltip,
  graphNeighborsFailedLabel,
  graphNeighborsFailedTooltip,
  graphNeighborsFailedInspectorLabel,
  graphNeighborsMissedLabel,
  graphNeighborsMissedTooltip,
  graphNeighborsMissedInspectorLabel,
  referencedNotesLabel,
  inspectorTitle,
  noteSectionLabel,
  selectionSectionLabel,
  workspaceSectionLabel,
  graphSectionLabel,
  referencedSectionLabel,
  emptyLabel,
  closeLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [panelEl, setPanelEl] = useState<HTMLDivElement | null>(null)

  const close = useCallback(() => setOpen(false), [])

  useFocusTrap(open, panelEl, {
    initialFocusRef: closeButtonRef,
    onEscape: close,
  })

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        close()
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [close, open])

  const notePreview = truncatePreview(snapshot.noteExcerpt, 320)
  const selectionPreview = truncatePreview(snapshot.selection, 240)

  const hasChips =
    hasNoteContext ||
    workspaceSearchCount > 0 ||
    graphNeighborCount > 0 ||
    workspaceSearchPending ||
    graphNeighborsPending ||
    workspaceSearchFailed ||
    workspaceSearchMissed ||
    graphNeighborsFailed ||
    graphNeighborsMissed ||
    referencedNoteCount > 0

  if (!hasChips) return null

  const openCurrentNote = () => {
    if (!snapshot.noteDocKey) return
    dispatchKnowledgeNavigate(
      'wiki',
      asMetadataResolvedTarget({ docKey: snapshot.noteDocKey }, 'compiler'),
    )
  }

  const renderWorkspaceSection = () => {
    if (workspaceSearchPending) {
      return <InspectorStatusNote label={workspaceSearchPendingInspectorLabel} />
    }
    if (workspaceSearchFailed) {
      return <InspectorStatusNote label={workspaceSearchFailedInspectorLabel} />
    }
    if (workspaceSearchMissed) {
      return <InspectorStatusNote label={workspaceSearchMissedInspectorLabel} />
    }
    return <NoteEntryList notes={snapshot.workspaceHits} emptyLabel={emptyLabel} />
  }

  const renderGraphSection = () => {
    if (graphNeighborsFailed) {
      return <InspectorStatusNote label={graphNeighborsFailedInspectorLabel} />
    }
    if (graphNeighborsMissed) {
      return <InspectorStatusNote label={graphNeighborsMissedInspectorLabel} />
    }
    return <NoteEntryList notes={snapshot.graphNeighbors} emptyLabel={emptyLabel} />
  }

  return (
    <div className="ai-rail-context-inspector" ref={rootRef}>
      <button
        type="button"
        className="ai-rail-context-inspector-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        data-testid="ai-context-inspector-trigger"
        onClick={() => setOpen((value) => !value)}
      >
        <AiContextChips
          hasNoteContext={hasNoteContext}
          workspaceSearchCount={workspaceSearchCount}
          graphNeighborCount={graphNeighborCount}
          workspaceSearchPending={workspaceSearchPending}
          graphNeighborsPending={graphNeighborsPending}
          workspaceSearchFailed={workspaceSearchFailed}
          workspaceSearchMissed={workspaceSearchMissed}
          graphNeighborsFailed={graphNeighborsFailed}
          graphNeighborsMissed={graphNeighborsMissed}
          referencedNoteCount={referencedNoteCount}
          noteLabel={noteLabel}
          workspaceSearchLabel={workspaceSearchLabel}
          workspaceSearchPendingLabel={workspaceSearchPendingLabel}
          workspaceSearchPendingTooltip={workspaceSearchPendingTooltip}
          workspaceSearchFailedLabel={workspaceSearchFailedLabel}
          workspaceSearchFailedTooltip={workspaceSearchFailedTooltip}
          workspaceSearchMissedLabel={workspaceSearchMissedLabel}
          workspaceSearchMissedTooltip={workspaceSearchMissedTooltip}
          graphNeighborsLabel={graphNeighborsLabel}
          graphNeighborsPendingLabel={graphNeighborsPendingLabel}
          graphNeighborsPendingTooltip={graphNeighborsPendingTooltip}
          graphNeighborsFailedLabel={graphNeighborsFailedLabel}
          graphNeighborsFailedTooltip={graphNeighborsFailedTooltip}
          graphNeighborsMissedLabel={graphNeighborsMissedLabel}
          graphNeighborsMissedTooltip={graphNeighborsMissedTooltip}
          referencedNotesLabel={referencedNotesLabel}
        />
      </button>
      {open ? (
        <div
          id={panelId}
          ref={(node) => {
            setPanelEl(node)
          }}
          className="ai-rail-context-inspector-panel"
          role="dialog"
          aria-modal="true"
          aria-label={inspectorTitle}
          data-testid="ai-context-inspector-panel"
        >
          <div className="ai-rail-context-inspector-header">
            <span className="ai-rail-context-inspector-title">{inspectorTitle}</span>
            <button
              ref={closeButtonRef}
              type="button"
              className="ai-rail-context-inspector-close"
              aria-label={closeLabel}
              onClick={close}
            >
              ×
            </button>
          </div>
          <div className="ai-rail-context-inspector-body">
            <section className="ai-rail-context-inspector-section">
              <h4>{noteSectionLabel}</h4>
              {snapshot.noteTitle ? (
                snapshot.noteDocKey ? (
                  <button
                    type="button"
                    className="ai-rail-context-inspector-link ai-rail-context-inspector-note-title"
                    data-testid={`ai-context-inspector-link-${snapshot.noteDocKey}`}
                    onClick={openCurrentNote}
                  >
                    {snapshot.noteTitle}
                  </button>
                ) : (
                  <p className="ai-rail-context-inspector-note-title">{snapshot.noteTitle}</p>
                )
              ) : null}
              {notePreview ? (
                <pre className="ai-rail-context-inspector-preview">{notePreview}</pre>
              ) : (
                <p className="ai-rail-context-inspector-empty">{emptyLabel}</p>
              )}
            </section>
            <section className="ai-rail-context-inspector-section">
              <h4>{selectionSectionLabel}</h4>
              {selectionPreview ? (
                <pre className="ai-rail-context-inspector-preview">{selectionPreview}</pre>
              ) : (
                <p className="ai-rail-context-inspector-empty">{emptyLabel}</p>
              )}
            </section>
            <section className="ai-rail-context-inspector-section">
              <h4>{workspaceSectionLabel}</h4>
              {renderWorkspaceSection()}
            </section>
            <section className="ai-rail-context-inspector-section">
              <h4>{graphSectionLabel}</h4>
              {renderGraphSection()}
            </section>
            <section className="ai-rail-context-inspector-section">
              <h4>{referencedSectionLabel}</h4>
              <NoteEntryList notes={snapshot.referencedNotes} emptyLabel={emptyLabel} />
            </section>
          </div>
        </div>
      ) : null}
    </div>
  )
}
