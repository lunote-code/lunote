import { getBlockGraphPhase } from '../lifecycleGraph'

export type BlockCommitScope = {
  blockId: string
  generation: number
  revoked: boolean
}

const scopes = new Map<string, BlockCommitScope>()
const destroyedBlocks = new Set<string>()

export function openBlockCommitScope(blockId: string, generation: number): BlockCommitScope {
  const scope: BlockCommitScope = { blockId, generation, revoked: false }
  scopes.set(blockId, scope)
  destroyedBlocks.delete(blockId)
  return scope
}

export function bumpBlockCommitGeneration(blockId: string): number {
  const prev = scopes.get(blockId)
  const generation = (prev?.generation ?? 0) + 1
  scopes.set(blockId, { blockId, generation, revoked: false })
  destroyedBlocks.delete(blockId)
  return generation
}

export function getBlockCommitGeneration(blockId: string): number {
  return scopes.get(blockId)?.generation ?? 0
}

export function revokeBlockCommitScope(blockId: string): void {
  const s = scopes.get(blockId)
  if (s) s.revoked = true
  destroyedBlocks.add(blockId)
  scopes.delete(blockId)
}

export function isBlockCommitAllowed(blockId: string, generation: number): boolean {
  if (!blockId) return false
  if (destroyedBlocks.has(blockId)) return false
  const phase = getBlockGraphPhase(blockId)
  if (phase === 'destroyed' || phase === 'suspended') return false
  const scope = scopes.get(blockId)
  if (!scope || scope.revoked) return false
  return scope.generation === generation
}

export type GuardedCommitOptions = {
  blockId: string
  generation: number
  phase?: 'render' | 'focus' | 'selection' | 'layout'
  run: () => void | Promise<void>
}

/**
 * Returns false if commit must be dropped (stale / destroyed / unmounted).
 */
export async function runGuardedAsyncCommit(opts: GuardedCommitOptions): Promise<boolean> {
  if (!isBlockCommitAllowed(opts.blockId, opts.generation)) return false
  await opts.run()
  return isBlockCommitAllowed(opts.blockId, opts.generation)
}

export function clearAsyncCommitGuards(blockId?: string): void {
  if (blockId) {
    revokeBlockCommitScope(blockId)
    destroyedBlocks.delete(blockId)
    return
  }
  scopes.clear()
  destroyedBlocks.clear()
}
