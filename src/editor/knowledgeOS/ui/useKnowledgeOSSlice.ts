import { useEffect, useState } from 'react'
import { getBacklinkPanelSnapshot } from '../backlinkPanelRuntime'
import {
  getKnowledgeOSSnapshot,
  subscribeKnowledgeOSSnapshot,
} from '../knowledgeUIBridge'
import { getKnowledgeSearchSnapshot, subscribeKnowledgeSearch } from '../knowledgeSearchRuntime'
import type {
  BacklinkPanelSnapshot,
  GraphViewportSnapshot,
  KnowledgeSearchSnapshot,
  NoteGraphSnapshot,
  OSKernelTickState,
} from '../types'

/** The only signal to subscribe to: OS revision (disables slice local derived caching of interaction state).*/
export function useOsRevision(): number {
  const [revision, setRevision] = useState(() => getKnowledgeOSSnapshot().revision)

  useEffect(() => {
    return subscribeKnowledgeOSSnapshot(() => {
      const next = getKnowledgeOSSnapshot().revision
      setRevision((prev) => (prev === next ? prev : next))
    })
  }, [])

  return revision
}

/** Read backlinks for the requested docKey (Luna active note), not only workspace tab activeDocKey. */
export function useBacklinkSlice(docKey: string | null): BacklinkPanelSnapshot | null {
  const revision = useOsRevision()
  void revision
  if (!docKey) return null
  return getBacklinkPanelSnapshot(docKey)
}

export function useGraphSlice(): NoteGraphSnapshot {
  const revision = useOsRevision()
  void revision
  return getKnowledgeOSSnapshot().graph
}

export function useSearchSlice(): KnowledgeSearchSnapshot {
  const osRevision = useOsRevision()
  const [search, setSearch] = useState(() => getKnowledgeSearchSnapshot())

  useEffect(() => {
    return subscribeKnowledgeSearch(() => {
      setSearch(getKnowledgeSearchSnapshot())
    })
  }, [])

  void osRevision
  return search
}

/** OKFL: UI only reads unified clock projection from OS snapshot.kernelTickState.*/
export function useInteractionKernelSlice(): OSKernelTickState {
  const revision = useOsRevision()
  void revision
  return getKnowledgeOSSnapshot().kernelTickState
}

export function useSurfaceLayoutSlice() {
  const revision = useOsRevision()
  void revision
  return getKnowledgeOSSnapshot().surfaceLayout
}

export function useGraphViewportSlice(): GraphViewportSnapshot {
  const revision = useOsRevision()
  void revision
  return getKnowledgeOSSnapshot().kernelTickState.graphViewport
}
