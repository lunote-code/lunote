import { getBlock, setBlockLayout as setCbrBlockLayout } from '../codeBlockRuntime'
import { arbitrateAuthority } from './deterministic'
import { bumpDocumentTick } from './documentClock'
import { scheduleRuntimeTask } from './runtimeScheduler'

export type BlockLayoutMeasure = {
  blockId: string
  height: number
  scrollTop: number
  surfaceWidth: number
  surfaceHeight: number
  measuredAt: number
}

const measures = new Map<string, BlockLayoutMeasure>()

export function getBlockLayoutMeasure(blockId: string): BlockLayoutMeasure | undefined {
  return measures.get(blockId)
}

export function commitBlockLayoutMeasure(
  blockId: string,
  patch: Partial<Omit<BlockLayoutMeasure, 'blockId' | 'measuredAt'>>,
): BlockLayoutMeasure {
  const prev = measures.get(blockId)
  const runtime = getBlock(blockId)
  const next: BlockLayoutMeasure = {
    blockId,
    height: patch.height ?? prev?.height ?? runtime?.state.height ?? 0,
    scrollTop: patch.scrollTop ?? prev?.scrollTop ?? runtime?.state.scrollTop ?? 0,
    surfaceWidth: patch.surfaceWidth ?? prev?.surfaceWidth ?? 0,
    surfaceHeight: patch.surfaceHeight ?? prev?.surfaceHeight ?? 0,
    measuredAt: Date.now(),
  }
  measures.set(blockId, next)

  scheduleRuntimeTask({
    key: `layout:${blockId}`,
    kind: 'layout',
    phase: 'layout',
    priority: 2,
    blockId,
    run: () => {
      arbitrateAuthority({ domain: 'layout', incoming: 'cbr', blockId })
      setCbrBlockLayout(blockId, {
        height: next.height,
        scrollTop: next.scrollTop,
      })
      bumpDocumentTick('layout')
    },
  })

  return next
}

export function measureBlockSurface(blockId: string, element: HTMLElement | null): BlockLayoutMeasure {
  if (!element) {
    return commitBlockLayoutMeasure(blockId, {})
  }
  const rect = element.getBoundingClientRect()
  return commitBlockLayoutMeasure(blockId, {
    surfaceWidth: Math.round(rect.width),
    surfaceHeight: Math.round(rect.height),
    height: Math.round(rect.height),
  })
}

export function clearBlockLayoutMeasure(blockId?: string): void {
  if (blockId) measures.delete(blockId)
  else measures.clear()
}
