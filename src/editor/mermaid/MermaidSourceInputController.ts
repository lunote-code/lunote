/**
 * The only entrance to Mermaid source code input (Pure Text Editor).
 * paste / Literal insertion only goes through this module, forking of other handlers is prohibited.
 */

export type MermaidSourceEditorApi = {
  getValue: () => string
  setValue: (next: string) => void
  getSelection: () => { start: number; end: number }
  setSelection: (cursor: number) => void
}

/** The only pasting entrance: plain text insertion, no parsing or AST modification*/
export function handlePaste(text: string, api: MermaidSourceEditorApi): void {
  const { start, end } = api.getSelection()
  const current = api.getValue()
  const next = current.slice(0, start) + text + current.slice(end)
  api.setValue(next)
  api.setSelection(start + text.length)
}

export function insertPlainText(text: string, api: MermaidSourceEditorApi): void {
  handlePaste(text, api)
}

function onPasteEvent(event: ClipboardEvent, api: MermaidSourceEditorApi): void {
  event.preventDefault()
  event.stopPropagation()
  const plain = event.clipboardData?.getData('text/plain') ?? ''
  handlePaste(plain, api)
}

/**
 * Bind textarea's only paste listener (capture).
 * @returns detach
 */
export function attachMermaidSourceInput(
  textarea: HTMLTextAreaElement,
  api: MermaidSourceEditorApi,
): () => void {
  const listener = (event: ClipboardEvent) => onPasteEvent(event, api)
  textarea.addEventListener('paste', listener, { capture: true })
  return () => textarea.removeEventListener('paste', listener, { capture: true })
}

export const MERMAID_SOURCE_SELECTOR = '.pm-mermaid-source'

export function isMermaidSourceElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return !!target.closest(MERMAID_SOURCE_SELECTOR)
}
