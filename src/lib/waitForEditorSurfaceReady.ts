import type { RefObject } from 'react'

import type { TiptapMarkdownEditorHandle } from '../editor/tiptapEditorTypes'
import { runAfterReactCommit } from '../editor/reactCommitScheduler'
import { pathsEqual } from './workspacePathUtils'

type VisualEditorRef = RefObject<Pick<TiptapMarkdownEditorHandle, 'getBoundDocumentKey' | 'getEditor'> | null>

export type WaitForEditorSurfaceReadyArgs = {
  mainPaneMode: 'visual' | 'source'
  visualEditorRef: VisualEditorRef
  path: string
  contentRef: RefObject<string>
  timeoutMs?: number
}

/** Keep document-loading chrome until React commits and the target editor surface is ready. */
export function waitForEditorSurfaceReady(args: WaitForEditorSurfaceReadyArgs): Promise<void> {
  const timeoutMs = args.timeoutMs ?? 10_000
  const targetPath = args.path.trim()
  if (!targetPath) return Promise.resolve()

  return new Promise((resolve) => {
    const deadline = performance.now() + timeoutMs
    runAfterReactCommit(() => {
      const poll = (): void => {
        if (performance.now() >= deadline) {
          resolve()
          return
        }
        if (args.mainPaneMode === 'source') {
          resolve()
          return
        }
        const surface = args.visualEditorRef.current
        const boundKey = surface?.getBoundDocumentKey()?.trim() ?? ''
        if (boundKey && pathsEqual(boundKey, targetPath)) {
          const editor = surface?.getEditor()
          if (editor && !editor.isDestroyed && editor.view?.dom) {
            resolve()
            return
          }
        }
        requestAnimationFrame(poll)
      }
      requestAnimationFrame(poll)
    })
  })
}
