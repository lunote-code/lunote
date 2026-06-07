import type { Editor } from '@tiptap/core'

import { isCodeEditGuardActive } from './lunaCodeContext'
import type { TiptapEditorCommand } from './tiptapEditorTypes'

export type VisualOpFailureReason = 'inCodeContext' | 'imeComposing' | 'unsupported'

export function isCommandAllowedInCodeContext(command: TiptapEditorCommand): boolean {
  return (
    command.type === 'insertText' ||
    command.type === 'selectAll' ||
    command.type === 'codeBlock' ||
    command.type === 'deleteSelection' ||
    command.type === 'clearFormatting' ||
    command.type === 'copyCodeBlock' ||
    command.type === 'indentCodeSelection' ||
    command.type === 'indentCodeBlock' ||
    command.type === 'code'
  )
}

export function isCommandAllowedWhileComposing(command: TiptapEditorCommand): boolean {
  return (
    command.type === 'insertText' ||
    command.type === 'selectAll' ||
    command.type === 'deleteSelection' ||
    command.type === 'clearFormatting'
  )
}

export function classifyVisualOpFailure(
  editor: Editor,
  command: TiptapEditorCommand,
): VisualOpFailureReason {
  if (editor.isDestroyed) return 'unsupported'
  if (isCodeEditGuardActive(editor.state) && !isCommandAllowedInCodeContext(command)) {
    return 'inCodeContext'
  }
  if (editor.view.composing && !isCommandAllowedWhileComposing(command)) {
    return 'imeComposing'
  }
  return 'unsupported'
}
