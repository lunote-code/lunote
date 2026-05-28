import type { BlockPatch } from './blockPatch'

export type BlockTransactionContext = {
  label: string
  patches: BlockPatch[]
  depth: number
}

let activeTx: BlockTransactionContext | null = null
let txDepth = 0

export function getActiveBlockTransaction(): BlockTransactionContext | null {
  return activeTx
}

export function isInsideBlockTransaction(): boolean {
  return txDepth > 0
}

export function beginBlockTransaction(label: string): BlockTransactionContext {
  txDepth += 1
  if (activeTx) return activeTx
  activeTx = { label, patches: [], depth: txDepth }
  return activeTx
}

export function endBlockTransaction(): BlockTransactionContext | null {
  const ctx = activeTx
  txDepth = Math.max(0, txDepth - 1)
  if (txDepth === 0) {
    activeTx = null
  }
  return ctx
}

export function recordBlockPatch(patch: BlockPatch): void {
  if (!activeTx) return
  activeTx.patches.push(patch)
}

export function getTransactionPatchCount(): number {
  return activeTx?.patches.length ?? 0
}
