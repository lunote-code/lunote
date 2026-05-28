import type { RenderPriority } from './renderPriority'
import { useUnifiedBlockRender } from './unified/useUnifiedBlockRender'
import type { BlockRendererType } from './unified/blockRenderer'

export type UseMermaidBlockRenderOptions = {
  blockId: string
  source: string
  enabled: boolean
  isEditMode: boolean
  isMindmap: boolean
  priority?: RenderPriority
}

export type UseMermaidBlockRenderResult = {
  busy: boolean
  error: string | null
  svgHostRef: ReturnType<typeof useUnifiedBlockRender>['hostRef']
  wrapRef: ReturnType<typeof useUnifiedBlockRender>['wrapRef']
  parseKind: ReturnType<typeof useUnifiedBlockRender>['parseResult']['kind']
}

/**
 * @deprecated Use useUnifiedBlockRender; preserve compatible exports.
 */
export function useMermaidBlockRender(options: UseMermaidBlockRenderOptions): UseMermaidBlockRenderResult {
  const blockType: BlockRendererType = options.isMindmap ? 'mindmap' : 'mermaid'
  const unified = useUnifiedBlockRender({
    blockId: options.blockId,
    blockType,
    source: options.source,
    enabled: options.enabled,
    isEditMode: options.isEditMode,
    priority: options.priority,
  })

  return {
    busy: unified.busy,
    error: unified.error,
    svgHostRef: unified.hostRef,
    wrapRef: unified.wrapRef,
    parseKind: unified.parseResult.kind,
  }
}
