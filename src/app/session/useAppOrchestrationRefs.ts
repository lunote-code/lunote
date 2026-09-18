import { useCallback, useRef, type MutableRefObject } from 'react'

import type { FlushEditorToMemoryOptions } from '../../lib/editorContentSync'

export type AppOrchestrationRefs = {
  leaveCurrentTabRef: MutableRefObject<(() => Promise<boolean>) | null>
  saveAllDirtyDocumentsRef: MutableRefObject<(() => Promise<boolean>) | null>
  flushEditorToMemoryRef: MutableRefObject<
    ((options?: FlushEditorToMemoryOptions) => Promise<boolean>) | null
  >
  dispatchOpenDocumentRef: MutableRefObject<(root: string, path: string, reason?: string) => Promise<void>>
  dispatchOpenDocumentInTabRef: MutableRefObject<
    (root: string, path: string, reason?: string) => Promise<void>
  >
  flushEditorToMemoryViaRef: (options?: FlushEditorToMemoryOptions) => Promise<boolean>
  dispatchOpenDocument: (root: string, path: string, reason?: string) => Promise<void>
  dispatchOpenDocumentInTabViaRef: (root: string, path: string, reason?: string) => Promise<void>
}

/** Cross-hook ref bridges (tab nav ↔ save ↔ workspace loader) extracted from AppRoot. */
export function useAppOrchestrationRefs(): AppOrchestrationRefs {
  const leaveCurrentTabRef = useRef<(() => Promise<boolean>) | null>(null)
  const saveAllDirtyDocumentsRef = useRef<() => Promise<boolean>>(async () => true)
  const flushEditorToMemoryRef = useRef<
    ((options?: FlushEditorToMemoryOptions) => Promise<boolean>) | null
  >(async () => true)
  const dispatchOpenDocumentRef = useRef<(root: string, path: string, reason?: string) => Promise<void>>(
    async () => {},
  )
  const dispatchOpenDocumentInTabRef = useRef<
    (root: string, path: string, reason?: string) => Promise<void>
  >(async () => {})

  const flushEditorToMemoryViaRef = useCallback(
    (options?: FlushEditorToMemoryOptions) =>
      flushEditorToMemoryRef.current?.(options) ?? Promise.resolve(true),
    [],
  )

  const dispatchOpenDocument = useCallback(async (root: string, path: string, reason?: string) => {
    await dispatchOpenDocumentRef.current(root, path, reason)
  }, [])

  const dispatchOpenDocumentInTabViaRef = useCallback(
    async (root: string, path: string, reason?: string) => {
      await dispatchOpenDocumentInTabRef.current(root, path, reason)
    },
    [],
  )

  return {
    leaveCurrentTabRef,
    saveAllDirtyDocumentsRef,
    flushEditorToMemoryRef,
    dispatchOpenDocumentRef,
    dispatchOpenDocumentInTabRef,
    flushEditorToMemoryViaRef,
    dispatchOpenDocument,
    dispatchOpenDocumentInTabViaRef,
  }
}
