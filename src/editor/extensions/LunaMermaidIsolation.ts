import { Extension } from '@tiptap/core'
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state'

import { shouldBypassRuntimeForTarget } from '../documentRuntime/nativeInput'
import {
  clearDomSelection,
  isMermaidPreviewDom,
  isMermaidToolbarDom,
  selectionContainsMermaidBlock,
} from '../mermaid/mermaidBlockSelection'

const MERMAID_ISOLATION_KEY = new PluginKey('lunaMermaidIsolation')

/**
 * Mermaid Block Runtime: Disable preview clicks from triggering NodeSelection;
 * NodeSelection is not allowed for mermaid in non-mermaid-block scope.
 */
export const LunaMermaidIsolation = Extension.create({
  name: 'lunaMermaidIsolation',
  priority: 1200,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: MERMAID_ISOLATION_KEY,
        props: {
          handleDOMEvents: {
            mousedown(view, event) {
              if (shouldBypassRuntimeForTarget(event.target)) return false
              const t = event.target as HTMLElement
              if (selectionContainsMermaidBlock(view.dom as HTMLElement)) {
                clearDomSelection()
              }
              if (isMermaidToolbarDom(t)) return false
              if (!isMermaidPreviewDom(t)) return false
              event.preventDefault()
              return true
            },
            click(_view, event) {
              if (shouldBypassRuntimeForTarget(event.target)) return false
              const t = event.target as HTMLElement
              if (isMermaidToolbarDom(t)) return false
              if (!isMermaidPreviewDom(t)) return false
              event.preventDefault()
              return true
            },
            dragstart(_view, event) {
              if (shouldBypassRuntimeForTarget(event.target)) {
                event.preventDefault()
                return true
              }
              return false
            },
          },
          handleClickOn(_view, _pos, node, _nodePos, event) {
            if (shouldBypassRuntimeForTarget(event.target)) return false
            const t = event.target as HTMLElement
            if (isMermaidToolbarDom(t)) return false
            if (node.type.name === 'mermaidBlock' && isMermaidPreviewDom(t)) {
              return true
            }
            if (isMermaidPreviewDom(t)) return true
            return false
          },
        },
        filterTransaction(tr, _state) {
          if (!tr.selectionSet) return true
          const sel = tr.selection
          if (!(sel instanceof NodeSelection) || sel.node.type.name !== 'mermaidBlock') {
            return true
          }
          const domSel = typeof document !== 'undefined' ? document.getSelection() : null
          const anchor = domSel?.anchorNode
          if (anchor instanceof HTMLElement && isMermaidPreviewDom(anchor)) {
            return false
          }
          if (anchor?.parentElement && isMermaidPreviewDom(anchor.parentElement)) {
            return false
          }
          return true
        },
      }),
    ]
  },
})
