import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'

import { requestCodeBlockCmEdit } from '../boundary/codeBlockBoundaryActions'
import { isCodeBlockCmEnabled } from '../cm/codeBlockCmFeature'
import { getCodeBlockCmViewInWrap } from '../cm/codeBlockCmFocus'
import { insertCodeBlockAtRange, resolveInsertCodeBlockRange } from './toggle'
import { resolveCodeBlockTextRange } from './selection'

const SHORTCUT_CM_FOCUS_MAX_ATTEMPTS = 180

function scheduleShortcutCmFocusRetry(run: () => void, tryCount: number): void {
  if (tryCount > 0 && tryCount % 12 === 0) {
    window.setTimeout(run, 0)
    return
  }
  requestAnimationFrame(run)
}

function lastCodeBlockPos(doc: Editor['state']['doc']): number | null {
  let last: number | null = null
  doc.descendants((node, pos) => {
    if (node.type.name === 'codeBlock') last = pos
  })
  return last
}

/** CM NodeView mounts after PM insert — retry until wrap + CM focus are ready. */
function focusCodeBlockCmAfterShortcut(editor: Editor): void {
  if (!isCodeBlockCmEnabled()) return

  const attempt = (tryCount = 0) => {
    if (editor.isDestroyed) return
    let range = resolveCodeBlockTextRange(editor.state.selection.$from)
    if (!range) {
      const blockPos = lastCodeBlockPos(editor.state.doc)
      if (blockPos != null) {
        editor.chain().focus().setTextSelection(blockPos + 1).scrollIntoView().run()
        range = resolveCodeBlockTextRange(editor.state.selection.$from)
      }
    }
    if (!range) {
      if (tryCount >= SHORTCUT_CM_FOCUS_MAX_ATTEMPTS) return
      scheduleShortcutCmFocusRetry(() => attempt(tryCount + 1), tryCount + 1)
      return
    }
    try {
      const wrap = editor.view.nodeDOM(range.blockPos) as HTMLElement | null
      if (!wrap?.matches('[data-luna-code-block-wrap]')) {
        if (tryCount >= SHORTCUT_CM_FOCUS_MAX_ATTEMPTS) return
        scheduleShortcutCmFocusRetry(() => attempt(tryCount + 1), tryCount + 1)
        return
      }
      requestCodeBlockCmEdit(wrap)
      const cmView = getCodeBlockCmViewInWrap(wrap)
      if (cmView?.hasFocus) return
      if (tryCount >= SHORTCUT_CM_FOCUS_MAX_ATTEMPTS) return
      scheduleShortcutCmFocusRetry(() => attempt(tryCount + 1), tryCount + 1)
    } catch {
      if (tryCount >= SHORTCUT_CM_FOCUS_MAX_ATTEMPTS) return
      scheduleShortcutCmFocusRetry(() => attempt(tryCount + 1), tryCount + 1)
    }
  }

  requestAnimationFrame(() => attempt())
}

/**
 * Shortcut key/menu: After toggle fence code block, if the selection falls outside the codeBlock text range, it will be included in the content area.
 * `$from.start()` / `$from.end()` is already the endpoint of the legal range of text within the block, and further `+1` is prohibited (an empty block will cross the boundary).
 */
export function toggleCodeBlockWithFocusAndLog(editor: Editor, language = 'text'): boolean {
  const { $from } = editor.state.selection

  let ok: boolean
  if ($from.parent.type.name === 'codeBlock') {
    ok = editor.chain().focus().toggleCodeBlock({ language }).run()
  } else {
    const range = resolveInsertCodeBlockRange(editor)
    ok =
      range != null
        ? insertCodeBlockAtRange(editor, range, language)
        : editor.chain().focus().toggleCodeBlock({ language }).run()
  }

  if (!ok) return false
  let s = editor.state
  const moveSelectionIntoCodeBlock = (contentStart: number) => {
    editor.chain().focus().setTextSelection(contentStart).run()
    s = editor.state
  }
  if (s.selection instanceof NodeSelection && s.selection.node.type.name === 'codeBlock') {
    moveSelectionIntoCodeBlock(s.selection.from + 1)
  } else if (s.selection.$from.parent.type.name === 'codeBlock') {
    const $fromAfter = s.selection.$from
    const contentStart = $fromAfter.start()
    const contentEnd = $fromAfter.end()
    const p = s.selection.from
    if (p < contentStart || p > contentEnd) {
      moveSelectionIntoCodeBlock(contentStart)
    }
  } else {
    const $pos = s.selection.$from
    const nodeAfter = $pos.nodeAfter
    if (nodeAfter?.type.name === 'codeBlock') {
      moveSelectionIntoCodeBlock($pos.pos + 1)
    } else {
      const nodeBefore = $pos.nodeBefore
      if (nodeBefore?.type.name === 'codeBlock') {
        const start = $pos.pos - nodeBefore.nodeSize
        moveSelectionIntoCodeBlock(start + 1)
      } else {
        const blockPos = lastCodeBlockPos(s.doc)
        if (blockPos != null) moveSelectionIntoCodeBlock(blockPos + 1)
      }
    }
  }
  focusCodeBlockCmAfterShortcut(editor)
  return true
}
