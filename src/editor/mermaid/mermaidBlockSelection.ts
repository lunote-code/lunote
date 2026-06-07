import type { Editor } from '@tiptap/core'

import { getInputFocusToken } from './mermaidSourceInputFocus'

export const MERMAID_SELECTION_SCOPE = 'mermaid-block'

import { isNativeInputDom } from '../documentRuntime/nativeInput'

export function isMermaidBlockDom(el: HTMLElement | null): boolean {
  return !!el?.closest('[data-mermaid-block-id]')
}

export function isMermaidSourceEditorDom(el: HTMLElement | null): boolean {
  return isNativeInputDom(el) && !!el?.closest('[data-mermaid-block-id]')
}

export function isMermaidPreviewDom(el: HTMLElement | null): boolean {
  return !!el?.closest('.pm-mermaid-preview, .mermaid-preview')
}

export function isMermaidToolbarDom(el: HTMLElement | null): boolean {
  return !!el?.closest('.code-header, .pm-mermaid-toolbar')
}

function getDocumentSelection(): Selection | null {
  if (typeof document === 'undefined') return null
  const selection = document.getSelection()
  if (!selection || selection.rangeCount < 1 || selection.isCollapsed) return null
  return selection
}

export function selectionContainsMermaidBlock(root?: ParentNode | null): boolean {
  const selection = getDocumentSelection()
  if (!selection) return false
  const scope = root ?? document
  const blocks = scope.querySelectorAll?.<HTMLElement>('[data-mermaid-block-id]')
  if (!blocks?.length) return false
  for (let rangeIndex = 0; rangeIndex < selection.rangeCount; rangeIndex += 1) {
    const range = selection.getRangeAt(rangeIndex)
    for (const block of blocks) {
      try {
        if (range.intersectsNode(block)) return true
      } catch {
        continue
      }
    }
  }
  return false
}

export function clearDomSelection(): boolean {
  const selection = getDocumentSelection()
  if (!selection) return false
  selection.removeAllRanges()
  return true
}

/** Mod-A: Select all when inputFocusToken is valid (dataset + token verification)*/
export function selectAllInMermaidBlock(_editor: Editor): boolean {
  const token = getInputFocusToken()
  if (!token || typeof document === 'undefined') return false

  const el = document.activeElement
  if (!(el instanceof HTMLTextAreaElement)) return false
  if (el.dataset.mermaidBlockId !== token.blockId) return false
  if (Number(el.dataset.mermaidFocusId) !== token.focusId) return false

  el.select()
  return true
}
