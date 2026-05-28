import { EditorView } from '@codemirror/view'
import type { WikiLinkTarget } from '../../knowledgeRuntime/types'

export type WikiLinkEditorHandlers = {
  onNavigate: (target: WikiLinkTarget) => void
  onHover: (target: WikiLinkTarget | null, pos: { x: number; y: number }) => void
}

export function createWikiLinkClickExtension(
  handlersRef: { current: WikiLinkEditorHandlers | null },
  resolveTargetRef: { current: ((pos: number) => WikiLinkTarget | null) | null },
) {
  return EditorView.domEventHandlers({
    click(event, view) {
      const h = handlersRef.current
      if (!h) return false
      if (!(event.metaKey || event.ctrlKey)) return false
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (pos == null) return false
      const target = resolveTargetRef.current?.(pos) ?? null
      if (!target) return false
      event.preventDefault()
      event.stopPropagation()
      h.onNavigate(target)
      return true
    },
    mousemove(event, view) {
      const h = handlersRef.current
      if (!h) return false
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (pos == null) {
        h.onHover(null, { x: event.clientX, y: event.clientY })
        return false
      }
      const target = resolveTargetRef.current?.(pos) ?? null
      if (target) {
        h.onHover(target, { x: event.clientX, y: event.clientY })
      } else {
        h.onHover(null, { x: event.clientX, y: event.clientY })
      }
      return false
    },
    mouseleave(event) {
      handlersRef.current?.onHover(null, { x: event.clientX, y: event.clientY })
      return false
    },
  })
}
