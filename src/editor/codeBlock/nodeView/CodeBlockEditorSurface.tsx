import type { EditorView } from '@codemirror/view'
import { memo } from 'react'

import { CodeBlockCmPane } from '../cm/CodeBlockCmPane'

type Props = {
  mountKey: string
  blockId: string | null
  doc: string
  languageId: string | null | undefined
  onChange: (value: string) => void
  onBlur: (relatedTarget: EventTarget | null) => void
  onBoundaryUp: () => boolean
  onBoundaryDown: () => boolean
  onDeleteEmptyBlock: () => boolean
  onUndo: () => boolean
  onRedo: () => boolean
  onViewReady: (view: EditorView) => void
}

export const CodeBlockEditorSurface = memo(function CodeBlockEditorSurface(props: Props) {
  return <CodeBlockCmPane tabSize={4} {...props} />
})
