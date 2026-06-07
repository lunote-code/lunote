import type { Editor } from '@tiptap/core'
import { runAfterReactCommit } from '../reactCommitScheduler'

export type MermaidInputFocusToken = {
  blockId: string
  focusId: number
}

let inputFocusToken: MermaidInputFocusToken | null = null
let focusIdSeq = 0
const pmEditableRestore = new WeakMap<Editor, boolean>()

export function getInputFocusToken(): MermaidInputFocusToken | null {
  return inputFocusToken
}

function lockPmInput(editor: Editor): void {
  if (!pmEditableRestore.has(editor)) {
    pmEditableRestore.set(editor, editor.isEditable)
  }
  runAfterReactCommit(() => {
    if (!pmEditableRestore.has(editor)) return
    if (editor.isEditable) editor.setEditable(false)
  })
}

function unlockPmInput(editor: Editor): void {
  const restore = pmEditableRestore.get(editor)
  if (restore === undefined) return
  runAfterReactCommit(() => {
    editor.setEditable(restore)
    pmEditableRestore.delete(editor)
  })
}

/** focus synchronously grants input rights (without microtask / rAF)*/
export function acquireInputFocusToken(
  blockId: string,
  textarea: HTMLTextAreaElement,
  editor?: Editor | null,
): MermaidInputFocusToken {
  focusIdSeq += 1
  const token: MermaidInputFocusToken = { blockId, focusId: focusIdSeq }
  inputFocusToken = token
  textarea.dataset.mermaidFocusId = String(token.focusId)
  if (editor) lockPmInput(editor)
  return token
}

/** When blur is released, it will only be released when the focusId still matches (to prevent expiration of blur and clear new focus)*/
export function releaseInputFocusToken(
  textarea: HTMLTextAreaElement,
  editor?: Editor | null,
): void {
  const token = inputFocusToken
  if (!token) return
  const blockId = textarea.dataset.mermaidBlockId
  const focusId = textarea.dataset.mermaidFocusId
  if (blockId !== token.blockId || Number(focusId) !== token.focusId) return
  inputFocusToken = null
  delete textarea.dataset.mermaidFocusId
  if (editor) unlockPmInput(editor)
}

/** block switching/forced barrier: clear token unconditionally*/
/** Restore PM editability when app/editor starts (to prevent the last Mermaid focus lock from remaining)*/
export function ensurePmInputUnlockedOnBoot(editor: Editor): void {
  inputFocusToken = null
  unlockPmInput(editor)
}

export function clearInputFocusToken(editor?: Editor | null): void {
  inputFocusToken = null
  if (typeof document !== 'undefined') {
    document
      .querySelectorAll<HTMLTextAreaElement>('textarea[data-mermaid-focus-id]')
      .forEach((ta) => {
        delete ta.dataset.mermaidFocusId
      })
  }
  if (editor) unlockPmInput(editor)
}

export function resolveMermaidBlockIdFromEvent(event: Event): string | null {
  const target = event.target
  if (!(target instanceof HTMLTextAreaElement)) return null
  return target.dataset.mermaidBlockId ?? null
}

/** [dataset blockId] + [token blockId/focusId] double verification*/
export function validateInputFocusForEvent(event: Event): {
  blockId: string
  textarea: HTMLTextAreaElement
  token: MermaidInputFocusToken
} | null {
  const token = inputFocusToken
  if (!token) return null

  const target = event.target
  if (!(target instanceof HTMLTextAreaElement)) return null

  const blockId = target.dataset.mermaidBlockId
  if (!blockId || blockId !== token.blockId) return null

  const elFocusId = target.dataset.mermaidFocusId
  if (!elFocusId || Number(elFocusId) !== token.focusId) return null

  return { blockId, textarea: target, token }
}

export function isMermaidInputKernelActive(): boolean {
  return inputFocusToken !== null
}

/** Document level editable (Mermaid input lock will setEditable(false), but the document is still editable)*/
export function isMermaidDocumentEditable(editor: Editor): boolean {
  if (editor.isEditable) return true
  return pmEditableRestore.has(editor)
}
