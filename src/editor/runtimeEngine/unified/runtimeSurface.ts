import type { UnifiedBlockLifecycle } from './blockLifecycle'

export type RuntimeSurfaceState = {
  busy: boolean
  error: string | null
  lifecycle: UnifiedBlockLifecycle
  blockType: string
}

const surfaceByBlock = new Map<string, RuntimeSurfaceState>()
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((fn) => fn())
}

export function subscribeRuntimeSurface(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getRuntimeSurface(blockId: string): RuntimeSurfaceState | undefined {
  return surfaceByBlock.get(blockId)
}

export function patchRuntimeSurface(
  blockId: string,
  patch: Partial<RuntimeSurfaceState>,
): RuntimeSurfaceState {
  const prev = surfaceByBlock.get(blockId) ?? {
    busy: false,
    error: null,
    lifecycle: 'mount' as UnifiedBlockLifecycle,
    blockType: 'mermaid',
  }
  const next = { ...prev, ...patch }
  surfaceByBlock.set(blockId, next)
  emit()
  return next
}

export function clearRuntimeSurface(blockId?: string): void {
  if (blockId) surfaceByBlock.delete(blockId)
  else surfaceByBlock.clear()
  emit()
}

export const RUNTIME_SURFACE_CLASS = {
  host: 'runtime-block-host',
  preview: 'runtime-block-preview',
  loading: 'runtime-block-loading',
  error: 'runtime-block-error',
  empty: 'runtime-block-empty',
} as const

export function runtimeSurfaceDataAttrs(state: RuntimeSurfaceState): Record<string, string> {
  return {
    'data-runtime-busy': state.busy ? 'true' : 'false',
    'data-runtime-error': state.error ? 'true' : 'false',
    'data-runtime-lifecycle': state.lifecycle,
    'data-runtime-block-type': state.blockType,
  }
}
