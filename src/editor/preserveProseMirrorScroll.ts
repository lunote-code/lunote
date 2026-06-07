import type { Editor } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'

type ScrollSnapshot = {
  el: HTMLElement
  top: number
  left: number
}

function scrollDomFor(editorOrView: Editor | EditorView): HTMLElement | null {
  if ('view' in editorOrView) {
    if (editorOrView.isDestroyed) return null
    return editorOrView.view.dom as HTMLElement
  }
  if (!editorOrView.dom.isConnected) return null
  return editorOrView.dom as HTMLElement
}

function captureScrollableAncestors(root: HTMLElement): ScrollSnapshot[] {
  const snapshots: ScrollSnapshot[] = []
  let current: HTMLElement | null = root
  while (current) {
    const style = window.getComputedStyle(current)
    const canScrollY =
      ['auto', 'scroll', 'overlay'].includes(style.overflowY) &&
      current.scrollHeight > current.clientHeight + 1
    const canScrollX =
      ['auto', 'scroll', 'overlay'].includes(style.overflowX) &&
      current.scrollWidth > current.clientWidth + 1
    if (canScrollY || canScrollX) {
      snapshots.push({ el: current, top: current.scrollTop, left: current.scrollLeft })
    }
    current = current.parentElement
  }
  return snapshots
}

function restoreScrollableAncestors(snapshots: ScrollSnapshot[]): void {
  for (const snapshot of snapshots) {
    if (!snapshot.el.isConnected) continue
    snapshot.el.scrollTop = snapshot.top
    snapshot.el.scrollLeft = snapshot.left
  }
}

/** Run a PM-side mutation without letting focus/scrollIntoView jump the viewport. */
export function preserveProseMirrorScrollDuring(editorOrView: Editor | EditorView, fn: () => void): void {
  const dom = scrollDomFor(editorOrView)
  if (!dom) {
    fn()
    return
  }
  const snapshots = captureScrollableAncestors(dom)
  const windowScrollX = window.scrollX
  const windowScrollY = window.scrollY
  fn()
  const restore = () => {
    const live = scrollDomFor(editorOrView)
    if (!live) return
    restoreScrollableAncestors(snapshots)
    window.scrollTo({ left: windowScrollX, top: windowScrollY, behavior: 'auto' })
  }
  queueMicrotask(restore)
  requestAnimationFrame(restore)
  requestAnimationFrame(() => requestAnimationFrame(restore))
}
