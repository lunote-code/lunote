import { useSyncExternalStore } from 'react'
import { isSurfaceResizing, subscribeSurfaceSplitLayout } from '../layout/surfaceSplitLayoutRuntime'

export function useSurfaceSplitResizing(): boolean {
  return useSyncExternalStore(subscribeSurfaceSplitLayout, isSurfaceResizing, isSurfaceResizing)
}
