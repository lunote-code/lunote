/** AI panel open requests (decoupled from AppRoot state). */

import type { AiAutoApplyMode, AiQuickActionId } from './actions/aiQuickActions'
import type { TaskMode } from './prompts/types'

type Sub = () => void

export type { AiAutoApplyMode }

export type PendingAiPanelOpen = {
  prefillDraft?: string
  systemHint?: string
  taskMode?: TaskMode
  actionId?: AiQuickActionId
  autoSend?: boolean
  autoApply?: AiAutoApplyMode | null
}

let pendingOpen: PendingAiPanelOpen | null = null
let openRequested = false
const subs = new Set<Sub>()

function notify(): void {
  for (const sub of subs) sub()
}

export function requestOpenAiPanel(options?: PendingAiPanelOpen): void {
  pendingOpen = options ?? null
  openRequested = true
  notify()
}

/** @deprecated use takePendingAiPanelOpen */
export function takePendingAiPanelDraft(): string | null {
  return takePendingAiPanelOpen()?.prefillDraft ?? null
}

export function takePendingAiPanelOpen(): PendingAiPanelOpen | null {
  const value = pendingOpen
  pendingOpen = null
  return value
}

export function consumeAiPanelOpenRequest(): boolean {
  if (!openRequested) return false
  openRequested = false
  return true
}

export function subscribeAiPanelStore(cb: Sub): () => void {
  subs.add(cb)
  return () => {
    subs.delete(cb)
  }
}

export function resetAiPanelStoreForTests(): void {
  pendingOpen = null
  openRequested = false
  notify()
}
