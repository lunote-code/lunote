import type { RuntimePhase } from './runtimePhase'

export type RuntimeTransactionOp = {
  id: string
  phase: RuntimePhase
  blockId?: string | null
  label: string
  run: () => void | Promise<void>
}

export type RuntimeTransaction = {
  id: string
  blockId?: string | null
  ops: RuntimeTransactionOp[]
  committed: boolean
}

let txCounter = 0
const openTransactions = new Map<string, RuntimeTransaction>()

export function beginRuntimeTransaction(blockId?: string | null): string {
  const id = `rtx:${++txCounter}`
  openTransactions.set(id, { id, blockId, ops: [], committed: false })
  return id
}

export function stageTransactionOp(
  txId: string,
  op: Omit<RuntimeTransactionOp, 'id'> & { id?: string },
): void {
  const tx = openTransactions.get(txId)
  if (!tx || tx.committed) return
  tx.ops.push({
    id: op.id ?? `${txId}:${tx.ops.length}`,
    phase: op.phase,
    blockId: op.blockId ?? tx.blockId,
    label: op.label,
    run: op.run,
  })
}

export function getRuntimeTransaction(txId: string): RuntimeTransaction | undefined {
  return openTransactions.get(txId)
}

export function abortRuntimeTransaction(txId: string): void {
  openTransactions.delete(txId)
}

export function detachRuntimeTransactionOps(txId: string): RuntimeTransactionOp[] {
  const tx = openTransactions.get(txId)
  if (!tx) return []
  const ops = [...tx.ops]
  openTransactions.delete(txId)
  return ops
}

export function clearRuntimeTransactions(): void {
  openTransactions.clear()
  txCounter = 0
}
