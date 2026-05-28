import { StateEffect, StateField, type Extension } from '@codemirror/state'
import { EditorSelection } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'

const NAV_JUMP_FLASH_MS = 1400

const navJumpFlashTimers = new WeakMap<EditorView, number>()

type FlashLineRange = { from: number; to: number }

const setNavigationJumpFlashEffect = StateEffect.define<FlashLineRange | null>()

const navigationJumpFlashField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes)
    for (const effect of tr.effects) {
      if (effect.is(setNavigationJumpFlashEffect)) {
        if (effect.value == null) return Decoration.none
        return Decoration.set([
          Decoration.line({ class: 'cm-navigation-jump-flash' }).range(effect.value.from),
        ])
      }
    }
    return decorations
  },
  provide: (field) => EditorView.decorations.from(field),
})

export const cmNavigationJumpFlashExt: Extension = navigationJumpFlashField

/** After outline/anchor jump: focus editor, highlight target row, pulse cursor (same row as selection)*/
export function flashCodeMirrorNavigationJump(view: EditorView, docPos: number): void {
  const clamped = Math.max(0, Math.min(docPos, view.state.doc.length))
  const sel = view.state.selection.main
  if (sel.from !== clamped || sel.to !== clamped) {
    view.dispatch({ selection: EditorSelection.cursor(clamped) })
  }
  const line = view.state.doc.lineAt(clamped)
  view.dispatch({
    effects: setNavigationJumpFlashEffect.of({ from: line.from, to: line.to }),
  })
  view.dom.classList.add('cm-editor--navigation-jump')
  try {
    view.focus()
  } catch {
    /* ignore */
  }
  const prev = navJumpFlashTimers.get(view)
  if (prev != null) clearTimeout(prev)
  const timer = window.setTimeout(() => {
    navJumpFlashTimers.delete(view)
    try {
      view.dispatch({ effects: setNavigationJumpFlashEffect.of(null) })
      view.dom.classList.remove('cm-editor--navigation-jump')
    } catch {
      /* view destroyed */
    }
  }, NAV_JUMP_FLASH_MS)
  navJumpFlashTimers.set(view, timer)
}
