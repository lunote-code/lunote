import type { BlockParseResult } from '../incrementalParser'
import type { RenderPriority } from '../renderPriority'

export type BlockRendererType = 'mermaid' | 'mindmap' | 'code' | 'markdown'

export type BlockRenderContext = {
  blockId: string
  source: string
  priority: RenderPriority
  signal: AbortSignal
}

export type BlockRenderOutput =
  | {
      kind: 'html'
      html: string
      bind?: (element: Element) => void
    }
  | { kind: 'empty' }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string }

export type BlockRenderer = {
  readonly type: BlockRendererType
  parse(blockId: string, source: string): BlockParseResult
  render(ctx: BlockRenderContext): Promise<BlockRenderOutput>
  destroy(blockId: string): void
  measure?(source: string): { width: number; height: number } | null
  defaultPriority(): RenderPriority
}
