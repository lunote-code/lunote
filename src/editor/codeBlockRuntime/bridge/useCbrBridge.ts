import type { Editor } from '@tiptap/core'
import { useEffect } from 'react'

import { getMermaidSourceBoundEditor } from '../../mermaid/mermaidSourceBridge'

/**
 * Confirm that the Bridge is bound to the current editor (done by MermaidSourceSessionProvider + LunaCbrBridgeSync).
 * Do not perform PM synchronization within React effects.
 */
export function useCbrBridge(editor: Editor | null): void {
  useEffect(() => {
    if (!editor) return
    const bound = getMermaidSourceBoundEditor()
    if (bound && bound !== editor) {
      console.warn('[CBR] editor instance mismatch between provider and hook')
    }
  }, [editor])
}
