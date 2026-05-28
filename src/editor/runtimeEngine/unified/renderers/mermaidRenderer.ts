import { renderMermaidSvg } from '../../asyncRenderBridge'
import { parseChangedBlock } from '../../incrementalParser'
import type { BlockRenderer, BlockRenderContext, BlockRenderOutput } from '../blockRenderer'

export const mermaidRenderer: BlockRenderer = {
  type: 'mermaid',
  parse(blockId, source) {
    return parseChangedBlock(blockId, source)
  },
  async render(ctx: BlockRenderContext): Promise<BlockRenderOutput> {
    if (ctx.signal.aborted) return { kind: 'cancelled' }
    if (!ctx.source.trim()) return { kind: 'empty' }

    const svg = await renderMermaidSvg(ctx.blockId, ctx.source, ctx.priority, ctx.signal)
    if (!svg || ctx.signal.aborted) return { kind: 'cancelled' }

    return {
      kind: 'html',
      html: svg.svg,
      bind: svg.bindFunctions,
    }
  },
  destroy(blockId) {
    void blockId
  },
  defaultPriority() {
    return 'visible'
  },
}
