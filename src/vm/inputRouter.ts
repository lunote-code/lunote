/**
 * InputRouter — single entry point for all structured UI input events.
 *
 * Routes structured inputs through the VM pipeline BEFORE any editor mutation:
 *   Event → context sampling → VMCommand → vmReduce → VMBridgeOp[] → Bridge
 *
 * ─────────────────────────────────────────────────────────────
 * WHAT IS FULLY VM-ROUTED (structured inputs):
 *   ✓ drop (plain text) — handleDrop plugin intercepts, creates InsertPlainTextCmd
 *✓ paste — ProseMirror / CodeMirror native paste (without custom pipeline)
 *   ✓ cut  — keyboard shortcut bridge creates CutCmd
 *   ✓ keyboard shortcuts (bold/italic/heading etc.) — cmManifestBridge + LunaEphemeralFormattingShortcuts
 *   ✓ slash menu actions — route through executeManifestCommand
 *   ✓ toolbar clicks — executeManifestCommand
 *   ✓ menu palette — executeManifestCommand
 *
 * TYPING / IME CONSTRAINT (hard platform limit — not a design deficiency):
 *   Character-level typing cannot be pre-routed through VMCommand because:
 *   1. `beforeinput` interception with preventDefault() breaks IME composition
 *      (Chinese pinyin, Japanese kana→kanji, Korean jamo, Arabic diacritics).
 *      On macOS/iOS, this also breaks: press-and-hold accent picker, dictation,
 *      predictive text, autocorrect.
 *   2. The W3C Input Events spec explicitly states that `beforeinput` events
 *      during composition MAY be suppressed by the browser and MUST NOT have
 *      `preventDefault()` called in ways that break the composition chain.
 *   RESOLUTION: VmTiptapRecorder captures the resulting PM Steps (ProseMirror's
 *   own deterministic, reversible, atomic step objects) for VM undo/redo.
 *   These ARE the "InsertStep / DeleteStep / ReplaceStep" this architecture
 *   specifies — just expressed in PM's native type system.
 *
 * DUAL EDITOR CONSTRAINT:
 *   Choosing one editor (PM or CM) is a product-level migration. Both are
 *   currently covered by their respective recorders and bridge operations.
 */
import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import type { VMCommand, SelectionContext } from './vmCommands'
import { vmReduce } from './vmReducer'
import { applyVMSteps } from '../editor/editorMutationBridge'

/**
 * Dispatch a VM command through the VM pipeline.
 * VMCommand → vmReduce → VMBridgeOp[] → applyVMSteps → Editor
 *
 * This is the single command dispatch path used by all input interception.
 * No external executor injection needed — the pipeline is self-contained.
 */
export function dispatchVMCommand(cmd: VMCommand): void {
  const result = vmReduce(cmd)
  applyVMSteps(result.ops)
}

// ─────────────────────────────────────────────────────────────
// Active doc ID (set when document changes)
// ─────────────────────────────────────────────────────────────

let activeDocId = ''
export function setInputRouterDocId(docId: string): void {
  activeDocId = docId
}

// ─────────────────────────────────────────────────────────────
// VmInputRouter — Tiptap extension
//Intercepts drop, cut at the PM plugin layer. Paste → PM / CM native behavior.
// Each event is converted to a VMCommand BEFORE any editor mutation.
// ─────────────────────────────────────────────────────────────

export const VmInputRouter = Extension.create({
  name: 'vmInputRouter',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          /**
           * Intercept drop (plain text) → InsertPlainTextCmd.
           */
          handleDrop(view, event) {
            const dt = event.dataTransfer
            if (!dt) return false
            const text = dt.getData('text/plain')
            if (!text) return false

            event.preventDefault()
            const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
            const pos = coords?.pos ?? view.state.selection.from
            const selection: SelectionContext = { from: pos, to: pos, empty: true }

            dispatchVMCommand({
              kind: 'insertPlainText',
              text,
              selection,
              docId: activeDocId,
            })
            return true
          },
        },
      }),
    ]
  },

  addKeyboardShortcuts() {
    return {
      /**
       * Intercept Ctrl/Cmd+X → CutCmd → vmReduce → bridge.cutSelection.
       * Runs BEFORE ProseMirror's native cut handler.
       */
      'Mod-x': ({ editor }) => {
        const { from, to, empty } = editor.state.selection
        if (empty) return false

        dispatchVMCommand({
          kind: 'cut',
          selection: { from, to, empty: false },
          docId: activeDocId,
        })
        return true
      },
    }
  },
})
