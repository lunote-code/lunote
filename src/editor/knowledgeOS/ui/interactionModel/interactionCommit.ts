import { advanceTickForInteractionCommit } from '../../osKernelClock'
import { invalidateKnowledgeOSSnapshot } from '../../knowledgeUIBridge'

export type CommitTraceBinding = {
  traceId: string
  osRevision: number
}

/**
 * IEM’s only commit entry: OSKernelClock tick is bound to trace frame 1:1.
 */
export function commitInteractionState(traceId: string): CommitTraceBinding {
  const osRevision = advanceTickForInteractionCommit(traceId)
  invalidateKnowledgeOSSnapshot()
  return { traceId, osRevision }
}
