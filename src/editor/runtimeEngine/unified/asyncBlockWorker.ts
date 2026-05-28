import { cancelAsyncRender } from '../asyncRenderBridge'
import type { RenderPriority } from '../renderPriority'
import { requireBlockRenderer } from './blockRuntimeRegistry'
import type { BlockRenderOutput, BlockRendererType } from './blockRenderer'

export type AsyncBlockRenderPayload = {
  blockId: string
  source: string
  generation: number
  priority: RenderPriority
}

const pendingByKey = new Map<string, Promise<BlockRenderOutput>>()

function taskKey(type: BlockRendererType, blockId: string): string {
  return `${type}:${blockId}`
}

/**
 * Unify async pipeline: route to registry renderer by block type.
 */
export function enqueueAsyncBlockRender(
  type: BlockRendererType,
  payload: AsyncBlockRenderPayload,
  signal?: AbortSignal,
): Promise<BlockRenderOutput> {
  const key = taskKey(type, payload.blockId)
  const renderer = requireBlockRenderer(type)

  const task = (async (): Promise<BlockRenderOutput> => {
    if (signal?.aborted) return { kind: 'cancelled' }
    return renderer.render({
      blockId: payload.blockId,
      source: payload.source,
      priority: payload.priority,
      signal: signal ?? new AbortController().signal,
    })
  })()

  pendingByKey.set(key, task)
  void task.finally(() => {
    if (pendingByKey.get(key) === task) pendingByKey.delete(key)
  })

  return task
}

export function cancelAsyncBlockRender(type: BlockRendererType, blockId: string): void {
  pendingByKey.delete(taskKey(type, blockId))
  if (type === 'mermaid') cancelAsyncRender(blockId)
}

export function cancelAllAsyncBlockRender(blockId: string): void {
  for (const type of ['mermaid', 'mindmap'] as const) {
    cancelAsyncBlockRender(type, blockId)
  }
}
