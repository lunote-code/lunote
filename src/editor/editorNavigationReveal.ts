import type { Editor } from '@tiptap/core'

import { findHeadingPositionInDoc } from './pmHeadingNav'
export { revealScrollContainer } from './visualModeViewportRestore'

export function centerRevealElementInContainer(container: HTMLElement, element: HTMLElement): number {
  const containerRect = container.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  const deltaTop = elementRect.top - containerRect.top
  const desired =
    container.scrollTop + deltaTop - (container.clientHeight - Math.max(1, elementRect.height)) / 2
  const max = Math.max(0, container.scrollHeight - container.clientHeight)
  const nextTop = Math.max(0, Math.min(max, desired))
  container.scrollTo({ top: nextTop, behavior: 'auto' })
  return nextTop
}

export function logRevealAnchorTrace(message: string, data: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return
  console.debug(message, data)
}

function elementFromNodeDom(node: globalThis.Node | null): HTMLElement | null {
  if (!node) return null
  if (node instanceof HTMLElement) return node
  return node.parentElement
}

export function findBlockRevealElement(editor: Editor, blockId: string): HTMLElement | null {
  const id = blockId.trim()
  if (!id) return null
  const dom = editor.view.dom as HTMLElement
  const escaped = CSS.escape(id)
  const byData = dom.querySelector(`[data-block-id="${escaped}"], [data-luna-block-id="${escaped}"]`)
  if (byData instanceof HTMLElement) return byData

  let found: HTMLElement | null = null
  editor.state.doc.descendants((node, pos) => {
    if (found) return false
    const attrs = node.attrs as Record<string, unknown>
    if (attrs.blockId === id || attrs.id === id || attrs['data-block-id'] === id) {
      found = elementFromNodeDom(editor.view.nodeDOM(pos))
      return false
    }
    if (node.isTextblock && node.textContent.includes(`^${id}`)) {
      found = elementFromNodeDom(editor.view.nodeDOM(pos))
      return false
    }
    return true
  })
  return found
}

export function findLineRevealElement(editor: Editor, line?: number): HTMLElement | null {
  if (!line || line < 1) return null
  let currentLine = 1
  let found: HTMLElement | null = null
  editor.state.doc.descendants((node, pos) => {
    if (found) return false
    if (node.isTextblock) {
      if (currentLine >= line) {
        found = elementFromNodeDom(editor.view.nodeDOM(pos))
        return false
      }
      currentLine += Math.max(1, node.textContent.split('\n').length)
    }
    return true
  })
  return found
}

export function findHeadingRevealElement(
  editor: Editor,
  headingSlug: string,
): { element: HTMLElement | null; pos: number | null } {
  const pos = findHeadingPositionInDoc(editor.state.doc, headingSlug)
  if (pos == null) return { element: null, pos: null }
  return { element: elementFromNodeDom(editor.view.nodeDOM(pos)), pos }
}

export function highlightRevealElement(element: HTMLElement): void {
  element.classList.add('navigation-reveal-highlight')
  window.setTimeout(() => {
    element.classList.remove('navigation-reveal-highlight')
  }, 1200)
}
