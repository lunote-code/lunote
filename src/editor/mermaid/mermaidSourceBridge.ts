import type { Editor } from '@tiptap/core'

import { flushAllBlocksToPm } from '../codeBlockRuntime/bridge/cbrToPmSync'
import { clearMermaidSourceStore, flushAllMermaidBlocks } from './mermaidSourceStore'

export type MermaidFlushReason =
  | 'tab-switch'
  | 'document-switch'
  | 'serialize'
  | 'transaction'
  | 'history'
  | 'explicit'

export type MermaidSourceBridge = {
  flushCommit: (editor: Editor, reason: MermaidFlushReason, commitId?: string) => boolean
  /** PM document change notification: only remap pos / close session, prohibit writing draft*/
  notifyPmDocChanged: (editor: Editor) => void
  flushBeforeDocChange: (editor: Editor) => void
  closeSource: (editor?: Editor | null) => void
  isComposing: () => boolean
}

let bridge: MermaidSourceBridge | null = null
let boundEditor: Editor | null = null

export function registerMermaidSourceBridge(next: MermaidSourceBridge | null, editor?: Editor | null): void {
  bridge = next
  boundEditor = editor ?? null
}

export function getMermaidSourceBridge(): MermaidSourceBridge | null {
  return bridge
}

export function getMermaidSourceBoundEditor(): Editor | null {
  return boundEditor
}

export function flushMermaidSourceForSerialize(editor: Editor): void {
  flushAllBlocksToPm(editor, 'serialize')
}

export function flushMermaidSourceForDocumentSwitch(editor: Editor): void {
  flushAllMermaidBlocks(editor, 'document-switch')
  clearMermaidSourceStore()
}
