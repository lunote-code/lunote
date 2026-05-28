import type { Editor } from '@tiptap/core'

import { focusBlock, getFocusedBlockId } from '../codeBlockRuntime'
import {
  acquireInputFocusToken,
  clearInputFocusToken,
  releaseInputFocusToken,
  type MermaidInputFocusToken,
} from '../mermaid/mermaidSourceInputFocus'
import { arbitrateAuthority } from './deterministic'
import { transitionBlockPhase } from './lifecycleGraph'
import {
  activateNativeInput,
  deactivateNativeInput,
  isNativeInputActive,
  mountNativeInput,
  setNativeInputComposing,
  unmountNativeInput,
} from './nativeInput'
import { commitBlockSelection } from './selectionRuntime'
export type FocusRealm = 'editor' | 'block-textarea' | 'block' | 'toolbar' | 'modal' | 'none'

let focusRealm: FocusRealm = 'none'
let currentFocusBlockId: string | null = null

export function getFocusRealm(): FocusRealm {
  return focusRealm
}

export function getFocusBlockId(): string | null {
  return currentFocusBlockId
}

export function acquireBlockTextareaFocus(
  blockId: string,
  textarea: HTMLTextAreaElement,
  editor?: Editor | null,
): MermaidInputFocusToken {
  arbitrateAuthority({ domain: 'focus', incoming: 'native-input', blockId })
  focusRealm = 'block-textarea'
  currentFocusBlockId = blockId
  transitionBlockPhase(blockId, 'interactive')
  const inputId = mountNativeInput({ type: 'textarea', dom: textarea, blockId })
  activateNativeInput(inputId)
  const token = acquireInputFocusToken(blockId, textarea, editor)
  return token
}

export function releaseBlockTextareaFocus(
  textarea: HTMLTextAreaElement,
  editor?: Editor | null,
): void {
  const inputId = textarea.dataset.nativeInputId
  if (inputId) {
    deactivateNativeInput(inputId)
    unmountNativeInput(inputId)
  }
  releaseInputFocusToken(textarea, editor)
  if (focusRealm === 'block-textarea') {
    focusRealm = 'none'
    currentFocusBlockId = null
  }
}

export function setNativeTextareaComposing(
  textarea: HTMLTextAreaElement,
  composing: boolean,
): void {
  const inputId = textarea.dataset.nativeInputId
  if (inputId) setNativeInputComposing(inputId, composing)
}

export function setBlockFocus(blockId: string | null): void {
  arbitrateAuthority({ domain: 'focus', incoming: 'cbr', blockId: blockId ?? undefined })
  focusRealm = blockId ? 'block' : 'none'
  currentFocusBlockId = blockId
  focusBlock(blockId)
  if (!isNativeInputActive()) commitBlockSelection(blockId)
  if (blockId) transitionBlockPhase(blockId, 'interactive')
}

export function clearDocumentFocus(editor?: Editor | null): void {
  arbitrateAuthority({ domain: 'focus', incoming: 'pm' })
  focusRealm = 'none'
  currentFocusBlockId = null
  clearInputFocusToken(editor)
}

export function syncFocusFromCbr(): void {
  const id = getFocusedBlockId()
  if (id && focusRealm !== 'block-textarea') {
    currentFocusBlockId = id
    if (focusRealm === 'none') focusRealm = 'block'
  }
}
