/** Mermaid / code-block native source editors live inside ProseMirror but must keep browser editing shortcuts. */
export function isBlockNativeSourceTextarea(el: HTMLElement | null): boolean {
  if (!(el instanceof HTMLTextAreaElement)) return false
  return !!el.dataset.mermaidBlockId || el.hasAttribute('data-code-block-input')
}

/** For auxiliary input such as CM search/replace panel, visual mode search bar, etc., you should use the browser's native editing shortcut keys.*/
function isAuxiliaryEditorChromeInput(el: HTMLElement): boolean {
  if (el.closest('.cm-panel')) return true
  if (el.closest('.editor-search-overlay')) return true
  if (isBlockNativeSourceTextarea(el)) return true
  return false
}

export function readBlockNativeTextareaSelection():
  | { text: string; textarea: HTMLTextAreaElement }
  | null {
  const active = document.activeElement
  if (!(active instanceof HTMLTextAreaElement)) return null
  if (!isBlockNativeSourceTextarea(active)) return null
  const { selectionStart, selectionEnd, value } = active
  return {
    text: value.slice(selectionStart, selectionEnd),
    textarea: active,
  }
}

/** Whether the focus is on the text editor (ProseMirror / CodeMirror), used for Tauri Cmd+V to paste routes*/
export function isEditorPasteFocusTarget(): boolean {
  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return false

  if (isAuxiliaryEditorChromeInput(active)) return false

  if (active.classList.contains('ProseMirror') || active.closest('.ProseMirror')) {
    if (isBlockNativeSourceTextarea(active)) return false
    return true
  }

  if (active.classList.contains('cm-content') || active.closest('.cm-content')) {
    return true
  }

  if (active.isContentEditable && active.closest('.tiptap-editor-content, .ProseMirror')) {
    return true
  }

  return false
}

/** Input boxes such as dialog box/command panel/sidebar search/CM search box should not take over Cmd+V, Cmd+A, etc.*/
export function isNonEditorTextInputTarget(): boolean {
  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return false

  if (isAuxiliaryEditorChromeInput(active)) return true
  if (isBlockNativeSourceTextarea(active)) return true

  if (active.closest('.ProseMirror, .cm-editor')) return false
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return true
  if (active.isContentEditable && !active.closest('.tiptap-editor-content')) return true
  return false
}
