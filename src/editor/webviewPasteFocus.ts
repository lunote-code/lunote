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

export type NativeTextInputSelection = {
  element: HTMLInputElement | HTMLTextAreaElement
  text: string
  start: number
  end: number
}

export function readNativeTextInputSelection(): NativeTextInputSelection | null {
  const active = document.activeElement
  if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) return null
  if (!isNonEditorTextInputTarget()) return null
  const { selectionStart, selectionEnd, value } = active
  if (selectionStart == null || selectionEnd == null) return null
  return {
    element: active,
    text: value.slice(selectionStart, selectionEnd),
    start: selectionStart,
    end: selectionEnd,
  }
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

function setNativeInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto =
    element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) setter.call(element, value)
  else element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

export function insertTextIntoNativeTextInput(
  element: HTMLInputElement | HTMLTextAreaElement,
  text: string,
): void {
  const start = element.selectionStart ?? element.value.length
  const end = element.selectionEnd ?? start
  const next = `${element.value.slice(0, start)}${text}${element.value.slice(end)}`
  setNativeInputValue(element, next)
  const caret = start + text.length
  element.setSelectionRange(caret, caret)
}

export async function pasteIntoFocusedNativeTextInput(text?: string): Promise<boolean> {
  const selection = readNativeTextInputSelection()
  const active = selection?.element ?? document.activeElement
  if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) return false
  if (!isNonEditorTextInputTarget()) return false

  const payload = text ?? (await navigator.clipboard.readText().catch(() => ''))
  if (!payload) {
    // execCommand('paste') triggers WebKit/Tauri "Paste" affordance banners — avoid for block source editors.
    if (isBlockNativeSourceTextarea(active)) return false
    if (typeof document.execCommand === 'function' && document.execCommand('paste')) return true
    return false
  }

  insertTextIntoNativeTextInput(active, payload)
  active.focus()
  return true
}

export async function cutNativeTextInputSelection(): Promise<boolean> {
  const selection = readNativeTextInputSelection()
  if (!selection) return false
  if (!selection.text) return false
  if (typeof document.execCommand === 'function' && document.execCommand('cut')) return true
  await navigator.clipboard.writeText(selection.text)
  const next = `${selection.element.value.slice(0, selection.start)}${selection.element.value.slice(selection.end)}`
  setNativeInputValue(selection.element, next)
  selection.element.setSelectionRange(selection.start, selection.start)
  selection.element.focus()
  return true
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
