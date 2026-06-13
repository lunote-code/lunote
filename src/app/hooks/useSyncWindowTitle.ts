import { useEffect } from 'react'

import { syncTauriWindowTitle } from '../../platform/tauri/windowTitleSync'

export function useSyncWindowTitle(
  documentTitle: string,
  workspaceTitle: string,
  fallbackAppName: string,
): void {
  useEffect(() => {
    void syncTauriWindowTitle(documentTitle, workspaceTitle, fallbackAppName)
  }, [documentTitle, workspaceTitle, fallbackAppName])
}
