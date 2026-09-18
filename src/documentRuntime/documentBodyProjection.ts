import { isBufferTabId } from './runtimePath'
import { parseFrontmatter } from '../editor/knowledgeRuntime/wikiLinkParser'

/** Editor/kernel/tab-body surface: body without YAML frontmatter (buffer tabs keep raw text). */
export function editorSurfaceForDocumentPath(path: string, markdown: string): string {
  if (!path || isBufferTabId(path)) return markdown
  return parseFrontmatter(markdown).body
}

/** DEV-only: warn when full markdown is written where body-only is expected. */
export function warnIfFullMarkdownInBodyStore(
  checkpoint: string,
  path: string,
  content: string,
): void {
  if (!import.meta.env.DEV || !path || isBufferTabId(path)) return
  const surface = parseFrontmatter(content).body
  if (surface.length === content.length) return
  console.warn(`[document-projection] ${checkpoint}: expected body-only storage`, {
    path,
    contentLength: content.length,
    bodyLength: surface.length,
  })
}
