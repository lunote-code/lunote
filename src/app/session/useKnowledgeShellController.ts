import { useEffect, type MutableRefObject } from 'react'

import { persistKnowledgeWorkspace } from '../../editor/knowledgeOS/ui/knowledgeAppIntegration'
import { syncKnowledgeWorkspaceTabsFromLuna } from '../../editor/knowledgeOS'
import {
  registerKnowledgeInteractionHost,
  type KnowledgeInteractionHost,
} from '../../editor/knowledgeOS/ui/knowledgeInteractionHost'
import { isBufferTabId } from '../workspace/constants'

export type KnowledgeShellControllerParams = {
  rootDir: string
  activePath: string
  openedTabs: string[]
  knowledgeRailVisible: boolean
  workspaceSyncTick: number
  workspaceRestoringRef: MutableRefObject<boolean>
  interactionHost: KnowledgeInteractionHost
}

/** Knowledge interaction host registration and workspace tab mirror extracted from AppRoot. */
export function useKnowledgeShellController(params: KnowledgeShellControllerParams) {
  const {
    rootDir,
    activePath,
    openedTabs,
    knowledgeRailVisible,
    workspaceSyncTick,
    workspaceRestoringRef,
    interactionHost,
  } = params

  useEffect(() => {
    registerKnowledgeInteractionHost(interactionHost)
    return () => registerKnowledgeInteractionHost(null)
  }, [interactionHost])

  useEffect(() => {
    if (!rootDir || workspaceRestoringRef.current) return
    syncKnowledgeWorkspaceTabsFromLuna(rootDir, openedTabs, activePath, isBufferTabId)
    persistKnowledgeWorkspace(rootDir)
  }, [activePath, knowledgeRailVisible, openedTabs, rootDir, workspaceRestoringRef, workspaceSyncTick])
}
