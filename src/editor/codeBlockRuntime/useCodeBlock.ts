import { useSyncExternalStore } from 'react'

import {
  getCodeBlockRuntimeSnapshot,
  subscribeCodeBlockRuntime,
} from './codeBlockRuntimeStore'
import type { CodeBlockMode, CodeBlockRuntime } from './types'

function useRuntimeSnapshot() {
  return useSyncExternalStore(
    subscribeCodeBlockRuntime,
    getCodeBlockRuntimeSnapshot,
    getCodeBlockRuntimeSnapshot,
  )
}

/** Subscribe to the CBR status of a single block (UI only data source)*/
export function useCodeBlock(blockId: string): CodeBlockRuntime | undefined {
  const snapshot = useRuntimeSnapshot()
  if (!blockId) return undefined
  return snapshot.blockMap.get(blockId)
}

export function useCodeBlockMode(blockId: string): CodeBlockMode {
  const snapshot = useRuntimeSnapshot()
  if (!blockId) return 'preview'
  const b = snapshot.blockMap.get(blockId)
  if (b) return b.state.mode
  return snapshot.pendingByBlockId.get(blockId)?.mode ?? 'preview'
}

export function useCodeBlockDraft(blockId: string): string {
  const snapshot = useRuntimeSnapshot()
  if (!blockId) return ''
  const block = snapshot.blockMap.get(blockId)
  if (block) return block.state.draft
  return snapshot.pendingByBlockId.get(blockId)?.draft ?? ''
}
