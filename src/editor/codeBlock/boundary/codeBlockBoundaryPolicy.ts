import type { Editor } from '@tiptap/core'
import type { ResolvedPos } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'

import { codeBlockStartDocPos } from '../behavior/nav'
import { isCodeBlockCmEnabled } from '../cm/codeBlockCmFeature'
import { isCodeBlockCmFocused } from '../cm/codeBlockCmFocus'

import {
  isCodeBlockFoldTransitionActive,
  isCodeBlockFoldTransitionActiveForView,
} from './codeBlockBoundaryRegistry'

export type CodeBlockInputPolicy = {
  inCodeBlock: boolean
  blockPos: number | null
  foldedInPm: boolean
  foldTransitionActive: boolean
  cmEnabled: boolean
  cmFocused: boolean
  shouldDelegateToCm: boolean
  shouldRedirectFoldedKeyboard: boolean
}

export function computeCodeBlockInputPolicy(args: {
  cmEnabled: boolean
  inCodeBlock: boolean
  foldedInPm: boolean
  foldTransitionActive: boolean
  cmFocused: boolean
}): Pick<CodeBlockInputPolicy, 'shouldDelegateToCm' | 'shouldRedirectFoldedKeyboard'> {
  const blockedByFold = args.foldedInPm || args.foldTransitionActive
  return {
    shouldDelegateToCm: args.cmEnabled && args.inCodeBlock && !blockedByFold && !args.cmFocused,
    shouldRedirectFoldedKeyboard: args.inCodeBlock && blockedByFold,
  }
}

function buildCodeBlockInputPolicy(
  $from: ResolvedPos,
  foldTransitionActive: boolean,
): CodeBlockInputPolicy {
  const cmEnabled = isCodeBlockCmEnabled()
  const cmFocused = isCodeBlockCmFocused()
  const inCodeBlock = $from.parent.type.name === 'codeBlock'
  const blockPos = inCodeBlock ? codeBlockStartDocPos($from) : null
  const foldedInPm = inCodeBlock ? Boolean($from.node().attrs.folded) : false
  const derived = computeCodeBlockInputPolicy({
    cmEnabled,
    inCodeBlock,
    foldedInPm,
    foldTransitionActive,
    cmFocused,
  })
  return {
    inCodeBlock,
    blockPos,
    foldedInPm,
    foldTransitionActive,
    cmEnabled,
    cmFocused,
    ...derived,
  }
}

/** Unified PM-layer policy for code-block keyboard / text-input routing. */
export function resolveCodeBlockInputPolicy(editor: Editor, $from: ResolvedPos): CodeBlockInputPolicy {
  const blockPos = $from.parent.type.name === 'codeBlock' ? codeBlockStartDocPos($from) : null
  const foldTransitionActive =
    blockPos != null ? isCodeBlockFoldTransitionActive(editor, blockPos) : false
  return buildCodeBlockInputPolicy($from, foldTransitionActive)
}

/** PM plugin path: resolve policy from EditorView when TipTap Editor is unavailable. */
export function resolveCodeBlockInputPolicyFromView(
  view: EditorView,
  $from: ResolvedPos,
): CodeBlockInputPolicy {
  const blockPos = $from.parent.type.name === 'codeBlock' ? codeBlockStartDocPos($from) : null
  const foldTransitionActive =
    blockPos != null ? isCodeBlockFoldTransitionActiveForView(view, blockPos) : false
  return buildCodeBlockInputPolicy($from, foldTransitionActive)
}

export function shouldPmDelegateCodeBlockInputToCm(editor: Editor, $from: ResolvedPos): boolean {
  return resolveCodeBlockInputPolicy(editor, $from).shouldDelegateToCm
}

export function shouldPmRedirectFoldedCodeBlockKeyboard(editor: Editor, $from: ResolvedPos): boolean {
  return resolveCodeBlockInputPolicy(editor, $from).shouldRedirectFoldedKeyboard
}
