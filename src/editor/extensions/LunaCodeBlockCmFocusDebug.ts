import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import {
  bootstrapCodeBlockCmFocusDebug,
  debugCodeBlockCmFocus,
  describeDomTarget,
  describePmSelection,
  installCodeBlockCmFocusDebugGlobals,
  isCodeBlockCmFocusDebug,
  probePmEventBelongsToView,
} from '../codeBlock/cm/codeBlockCmFocusDebug'
import { describePmLockState } from '../codeBlock/cm/codeBlockCmPmFocusLock'
import { isCodeBlockCmDom } from '../codeBlock/cm/codeBlockCmDom'

const CODE_BLOCK_CM_FOCUS_DEBUG_KEY = new PluginKey('lunaCodeBlockCmFocusDebug')

function isNearCodeBlock(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return !!target.closest('[data-luna-code-block-wrap], .ProseMirror')
}

/**
 * Optional instrumentation for code-block CM focus / PM selection conflicts.
 * Enable: `__lunaCodeBlockCmFocusEnable()` or `localStorage.setItem('luna.debug.codeBlockCmFocus', '1')` then refresh.
 * Dev mode also appends JSONL to `~/.luna/logs/codeblock-cm-focus.jsonl` (Console paused by default).
 */
export const LunaCodeBlockCmFocusDebug = Extension.create({
  name: 'lunaCodeBlockCmFocusDebug',
  priority: 998,

  onCreate() {
    if (!isCodeBlockCmFocusDebug()) return
    bootstrapCodeBlockCmFocusDebug()
    installCodeBlockCmFocusDebugGlobals(this.editor)

    let lastEditable = this.editor.isEditable
    const onEditableWatch = () => {
      if (this.editor.isEditable === lastEditable) return
      debugCodeBlockCmFocus('editor-editable-changed', {
        from: lastEditable,
        to: this.editor.isEditable,
        pmLock: describePmLockState(this.editor),
        pmSelection: describePmSelection(this.editor.view),
        activeElement: describeDomTarget(document.activeElement),
      })
      lastEditable = this.editor.isEditable
    }
    this.editor.on('update', onEditableWatch)
    this.editor.on('transaction', onEditableWatch)
    this.editor.on('destroy', () => {
      this.editor.off('update', onEditableWatch)
      this.editor.off('transaction', onEditableWatch)
    })
  },

  addProseMirrorPlugins() {
    if (!isCodeBlockCmFocusDebug()) return []

    return [
      new Plugin({
        key: CODE_BLOCK_CM_FOCUS_DEBUG_KEY,
        props: {
          handleDOMEvents: {
            mousedown(view, event) {
              if (!isNearCodeBlock(event.target)) return false
              const probe = probePmEventBelongsToView(view, event)
              debugCodeBlockCmFocus('pm-mousedown', {
                target: describeDomTarget(event.target),
                defaultPrevented: event.defaultPrevented,
                belongsToPm: probe.belongsToPm,
                stopNode: probe.stopNode,
                inCmDom: isCodeBlockCmDom(event.target as HTMLElement),
                selection: describePmSelection(view),
              })
              return false
            },
            pointerdown(view, event) {
              if (!isNearCodeBlock(event.target)) return false
              const probe = probePmEventBelongsToView(view, event)
              debugCodeBlockCmFocus('pm-pointerdown', {
                target: describeDomTarget(event.target),
                defaultPrevented: event.defaultPrevented,
                belongsToPm: probe.belongsToPm,
                stopNode: probe.stopNode,
                inCmDom: isCodeBlockCmDom(event.target as HTMLElement),
                selection: describePmSelection(view),
              })
              return false
            },
            focus(view, event) {
              if (!isNearCodeBlock(event.target)) return false
              debugCodeBlockCmFocus('pm-focus', {
                target: describeDomTarget(event.target),
                selection: describePmSelection(view),
              })
              return false
            },
          },
        },
        filterTransaction(tr, state) {
          if (tr.docChanged) {
            state.doc.descendants((node, pos) => {
              if (node.type.name !== 'codeBlock') return
              const mappedPos = tr.mapping.map(pos)
              const nextNode = tr.doc.nodeAt(mappedPos)
              if (nextNode?.type.name !== 'codeBlock') return
              const prevFolded = Boolean(node.attrs.folded)
              const nextFolded = Boolean(nextNode.attrs.folded)
              if (prevFolded === nextFolded) return
              debugCodeBlockCmFocus('pm-folded-attr-tx', {
                blockPos: mappedPos,
                prevFolded,
                nextFolded,
                steps: tr.steps.length,
                meta: {
                  uiEvent: tr.getMeta('uiEvent'),
                  inputLayerSource: tr.getMeta('inputLayerSource'),
                },
              })
            })
          }

          if (!tr.selectionSet) return true
          const before = { from: state.selection.from, to: state.selection.to }
          const after = { from: tr.selection.from, to: tr.selection.to }
          const jumpedToDocStart = after.from <= 2 && before.from > 2
          const leftCodeBlock =
            state.selection.$from.parent.type.name === 'codeBlock' &&
            tr.selection.$from.parent.type.name !== 'codeBlock'
          if (jumpedToDocStart || leftCodeBlock || after.from !== before.from) {
            debugCodeBlockCmFocus('pm-selection-tx', {
              jumpedToDocStart,
              leftCodeBlock,
              before,
              after,
              steps: tr.steps.length,
              docChanged: tr.docChanged,
              meta: {
                uiEvent: tr.getMeta('uiEvent'),
                inputLayerSource: tr.getMeta('inputLayerSource'),
                scrollIntoView: tr.getMeta('scrollIntoView'),
              },
            })
          }
          return true
        },
        view(editorView) {
          const pmDom = editorView.dom

          const onCapturePointer = (event: Event) => {
            if (!isNearCodeBlock(event.target)) return
            debugCodeBlockCmFocus('capture-pointer', {
              type: event.type,
              target: describeDomTarget(event.target),
              defaultPrevented: event.defaultPrevented,
              activeElement: describeDomTarget(document.activeElement),
            })
          }

          pmDom.addEventListener('pointerdown', onCapturePointer, true)
          pmDom.addEventListener('mousedown', onCapturePointer, true)

          return {
            update(view, prevState) {
              if (view.state.selection.eq(prevState.selection)) return
              debugCodeBlockCmFocus('pm-selection-update', {
                before: {
                  from: prevState.selection.from,
                  to: prevState.selection.to,
                  parentType: prevState.selection.$from.parent.type.name,
                },
                after: describePmSelection(view),
                activeElement: describeDomTarget(document.activeElement),
              })
            },
            destroy() {
              pmDom.removeEventListener('pointerdown', onCapturePointer, true)
              pmDom.removeEventListener('mousedown', onCapturePointer, true)
            },
          }
        },
      }),
    ]
  },
})
