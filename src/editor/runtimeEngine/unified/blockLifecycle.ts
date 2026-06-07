import {
  removeBlockNode,
  transitionBlockPhase,
} from '../../documentRuntime/lifecycleGraph'
import {
  clearBlockViewport,
  getBlockLifecycle,
  isBlockVirtualized,
  markBlockDestroyed,
  markBlockHidden,
  markBlockNearViewport,
  markBlockVisible,
  shouldRenderBlockPreview,
  type BlockLifecycle,
} from '../virtualBlockViewport'

export type UnifiedBlockLifecycle = BlockLifecycle | 'suspended'

const suspendedBlocks = new Set<string>()

export function mountBlockLifecycle(blockId: string): void {
  if (!blockId) return
  suspendedBlocks.delete(blockId)
  transitionBlockPhase(blockId, 'mount')
}

export function suspendBlockLifecycle(blockId: string): void {
  if (!blockId) return
  suspendedBlocks.add(blockId)
}

export function destroyBlockLifecycle(blockId: string): void {
  if (!blockId) return
  suspendedBlocks.delete(blockId)
  markBlockDestroyed(blockId)
  clearBlockViewport(blockId)
  removeBlockNode(blockId)
}

export function getUnifiedBlockLifecycle(blockId: string): UnifiedBlockLifecycle {
  if (suspendedBlocks.has(blockId)) return 'suspended'
  return getBlockLifecycle(blockId)
}

export function shouldUnifiedBlockRender(blockId: string): boolean {
  if (suspendedBlocks.has(blockId)) return false
  return shouldRenderBlockPreview(blockId)
}

export function isUnifiedBlockVirtualized(blockId: string): boolean {
  if (suspendedBlocks.has(blockId)) return true
  return isBlockVirtualized(blockId)
}

export {
  markBlockVisible,
  markBlockHidden,
  markBlockNearViewport,
  getBlockLifecycle,
  clearBlockViewport,
}
