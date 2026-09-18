import { useLayoutEffect, type MutableRefObject } from 'react'

import { useDocumentSave, type DocumentSaveDeps } from '../hooks/useDocumentSave'
import { useTabNavigation, type TabNavigationDeps } from '../hooks/useTabNavigation'

export type DocumentOperationsControllerParams = {
  dispatchOpenDocumentRef: MutableRefObject<
    (root: string, path: string, reason?: string) => Promise<void>
  >
  dispatchOpenDocumentInTabRef: MutableRefObject<
    (root: string, path: string, reason?: string) => Promise<void>
  >
  saveDeps: DocumentSaveDeps
  tabNavDeps: Omit<TabNavigationDeps, 'saveCurrent'>
}

/** Save + tab navigation orchestration extracted from AppRoot. */
export function useDocumentOperationsController(params: DocumentOperationsControllerParams) {
  const { dispatchOpenDocumentRef, dispatchOpenDocumentInTabRef, saveDeps, tabNavDeps } = params

  const { saveCurrent, saveAsCurrent, runAppExportFormat, runAppPrint } = useDocumentSave(saveDeps)

  const tabNavigation = useTabNavigation({
    ...tabNavDeps,
    saveCurrent,
  })

  useLayoutEffect(() => {
    dispatchOpenDocumentRef.current = tabNavigation.dispatchOpenDocument
    dispatchOpenDocumentInTabRef.current = tabNavigation.dispatchOpenDocumentInTab
  }, [
    dispatchOpenDocumentInTabRef,
    dispatchOpenDocumentRef,
    tabNavigation.dispatchOpenDocument,
    tabNavigation.dispatchOpenDocumentInTab,
  ])

  return {
    saveCurrent,
    saveAsCurrent,
    runAppExportFormat,
    runAppPrint,
    ...tabNavigation,
  }
}
