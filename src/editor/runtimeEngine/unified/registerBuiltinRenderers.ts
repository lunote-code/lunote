import { registerBlockRenderer } from './blockRuntimeRegistry'
import { mermaidRenderer } from './renderers/mermaidRenderer'
import { mindmapRenderer } from './renderers/mindmapRenderer'

let registered = false

export function registerBuiltinBlockRenderers(): void {
  if (registered) return
  registerBlockRenderer(mermaidRenderer)
  registerBlockRenderer(mindmapRenderer)
  registered = true
}
