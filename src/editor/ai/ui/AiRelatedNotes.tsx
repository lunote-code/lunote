import { useMemo } from 'react'
import { buildAiGraphContext } from '../context/buildAiGraphContext'
import {
  asMetadataResolvedTarget,
  dispatchKnowledgeNavigate,
} from '../../knowledgeOS/ui/interactionTransaction'

const RELATED_NOTE_LIMIT = 3

type Props = {
  docKey: string | null
  titleLabel: string
}

export function AiRelatedNotes({ docKey, titleLabel }: Props) {
  const neighbors = useMemo(() => {
    if (!docKey) return []
    return buildAiGraphContext(docKey).slice(0, RELATED_NOTE_LIMIT)
  }, [docKey])

  if (neighbors.length === 0) return null

  return (
    <div className="ai-rail-related-notes" data-testid="ai-related-notes">
      <span className="ai-rail-related-notes-label">{titleLabel}</span>
      <ul className="ai-rail-related-notes-list">
        {neighbors.map((note) => (
          <li key={note.docKey}>
            <button
              type="button"
              className="ai-rail-related-notes-link"
              data-testid={`ai-related-note-${note.docKey}`}
              onClick={() =>
                dispatchKnowledgeNavigate(
                  'wiki',
                  asMetadataResolvedTarget({ docKey: note.docKey }, 'compiler'),
                )
              }
            >
              {note.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
