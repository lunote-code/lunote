import type { Editor } from '@tiptap/core'
import type { Node as PmNode } from '@tiptap/pm/model'

import type { CodeBlockSessionEvent, CodeBlockSessionState } from '../state/codeBlockSessionState'

export type CodeBlockBlurSuppressReason = 'cm' | 'toolbar'

export type CodeBlockBoundarySnapshot = {
  foldTransitionActive: boolean
  foldTraceId: string | null
  blurSuppressUntil: number
  blurSuppressReason: CodeBlockBlurSuppressReason | null
  focusCmAfterRender: boolean
  selectionEnteredFoldedBlock: boolean
  foldToggleHandledOnPointer: boolean
}

export type CodeBlockBoundaryDeps = {
  editor: Editor
  getPos: (() => number | undefined) | undefined
  node: PmNode
  folded: boolean
  resolveOwnedBlockPos: () => number | null
  isBlockFoldedInPm: () => boolean
  wrapEl: () => HTMLElement | null
  dispatchSession: (event: CodeBlockSessionEvent) => void
  getSessionState: () => CodeBlockSessionState
  flushSessionToPm: () => void
  scheduleFocusCm: () => void
  onExitEditingAfterBlur: () => void
}

export type CodeBlockCmBlurContext = {
  relatedTarget: EventTarget | null
  composing: boolean
  cmHasFocus: boolean
  focusCmAfterRender: boolean
  paletteOpen: boolean
  activeInWrap: boolean
}
