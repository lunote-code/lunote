import type { Transaction } from '@tiptap/pm/state'

/** CBR → PM writes transaction metadata (PM → CBR must be skipped)*/
export const CBR_COMMIT_META = 'cbrCommit'

export type CbrCommitMeta = {
  from: 'cbr'
  blockId: string
  commitId: string
  reason: string
}

const lastAppliedCommitByBlockId = new Map<string, string>()

export function getCbrCommitMeta(tr: Transaction): CbrCommitMeta | undefined {
  const raw = tr.getMeta(CBR_COMMIT_META)
  if (!raw || typeof raw !== 'object') return undefined
  const m = raw as Partial<CbrCommitMeta>
  if (m.from !== 'cbr' || !m.blockId || !m.commitId) return undefined
  return {
    from: 'cbr',
    blockId: m.blockId,
    commitId: m.commitId,
    reason: String(m.reason ?? ''),
  }
}

export function isCbrOriginTransaction(tr: Transaction): boolean {
  return !!getCbrCommitMeta(tr)
}

export function transactionsIncludeCbrOrigin(transactions: readonly Transaction[]): boolean {
  return transactions.some(isCbrOriginTransaction)
}

export function getLastAppliedCommitId(blockId: string): string | undefined {
  return lastAppliedCommitByBlockId.get(blockId)
}

export function markCommitApplied(blockId: string, commitId: string): void {
  lastAppliedCommitByBlockId.set(blockId, commitId)
}

export function clearCommitTracking(blockId?: string): void {
  if (blockId) lastAppliedCommitByBlockId.delete(blockId)
  else lastAppliedCommitByBlockId.clear()
}

/** PM→CBR: whether draft writeback should be skipped*/
export function shouldSkipPmToCbr(args: {
  blockId: string
  pmSource: string
  cbrDraft: string | undefined
  incomingCommitId?: string
  isComposing?: boolean
}): boolean {
  if (args.isComposing) return true
  if (args.cbrDraft === args.pmSource) return true
  const last = lastAppliedCommitByBlockId.get(args.blockId)
  if (last && args.incomingCommitId && last === args.incomingCommitId) return true
  return false
}

/** CBR→PM: discard if commitId expires*/
export function shouldSkipCbrToPm(args: {
  blockId: string
  expectedCommitId: string
  currentCommitId: string
}): boolean {
  return args.expectedCommitId !== args.currentCommitId
}
