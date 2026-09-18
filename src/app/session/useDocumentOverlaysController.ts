import { useHistoryAndConflictOverlays } from '../hooks/useHistoryAndConflictOverlays'

export type DocumentOverlaysControllerParams = Parameters<typeof useHistoryAndConflictOverlays>[0]

/** History restore + save conflict overlays extracted from AppRoot. */
export function useDocumentOverlaysController(params: DocumentOverlaysControllerParams) {
  return useHistoryAndConflictOverlays(params)
}
