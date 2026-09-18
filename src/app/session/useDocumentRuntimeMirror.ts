import { useRef } from 'react'
import { useSyncExternalStore } from 'react'

import {
  getDocumentRuntimeSnapshot,
  subscribeDocumentRuntime,
} from '../../documentRuntime/documentKernel'
import {
  getWorkspaceSessionSnapshot,
  subscribeWorkspaceSession,
} from '../../documentRuntime/workspaceSessionRuntime'

/** Kernel snapshot subscription + imperative mirrors for async navigation paths. */
export function useDocumentRuntimeMirror() {
  const documentSnapshot = useSyncExternalStore(
    subscribeDocumentRuntime,
    getDocumentRuntimeSnapshot,
    getDocumentRuntimeSnapshot,
  )
  const workspaceSessionSnapshot = useSyncExternalStore(
    subscribeWorkspaceSession,
    getWorkspaceSessionSnapshot,
    getWorkspaceSessionSnapshot,
  )

  const activePath = documentSnapshot.activePath
  const content = documentSnapshot.content
  const openedTabs = documentSnapshot.openedTabs

  const activePathRef = useRef(activePath)
  const contentRef = useRef(content)
  activePathRef.current = activePath
  contentRef.current = content

  return {
    documentSnapshot,
    workspaceSessionSnapshot,
    activePath,
    content,
    openedTabs,
    activePathRef,
    contentRef,
  }
}
