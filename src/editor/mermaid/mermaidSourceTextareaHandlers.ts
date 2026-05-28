import {
  attachSelectionCycleComposition,
  detachSelectionCycle,
  isTextareaComposing,
} from '../nativeInput/selectionCycle'
import {
  resetSelectionFrameForBlock,
  runClipboardCopy,
  runClipboardCut,
  runSelectAll,
  scheduleFrameSyncFlush,
  scheduleValueMutation,
  setPipelineCompleteHook,
} from '../nativeInput/selectionCycle/v2'
import { validateInputFocusForEvent } from './mermaidSourceInputFocus'

const INDENT = '  '

export type MermaidTextareaNativeHandlersOptions = {
  blockId?: string
  /** Frame N: Controlled value barrier (prevents React from covering DOM)*/
  onDomAuthority?: (value: string) => void
  /** Frame N+1：commit draft */
  onValueChange?: (value: string) => void
  /** Frame N+2 pipeline completed*/
  onPipelineComplete?: () => void
}

function lineStartIndex(text: string, cursor: number): number {
  const nl = text.lastIndexOf('\n', Math.max(0, cursor - 1))
  return nl === -1 ? 0 : nl + 1
}

function outdentLine(text: string, lineStart: number): { text: string; removed: number } {
  const lineEnd = text.indexOf('\n', lineStart)
  const end = lineEnd === -1 ? text.length : lineEnd
  const line = text.slice(lineStart, end)
  let removed: number
  if (line.startsWith('\t')) removed = 1
  else {
    const m = line.match(/^ {1,2}/)
    removed = m?.[0].length ?? 0
  }
  if (removed === 0) return { text, removed: 0 }
  const next = text.slice(0, lineStart) + line.slice(removed) + text.slice(end)
  return { text: next, removed }
}

function indentLine(
  text: string,
  lineStart: number,
  selStart: number,
  selEnd: number,
): { text: string; selStart: number; selEnd: number } {
  const lineEnd = text.indexOf('\n', lineStart)
  const end = lineEnd === -1 ? text.length : lineEnd
  const next = text.slice(0, lineStart) + INDENT + text.slice(lineStart, end) + text.slice(end)
  const offset = selStart >= lineStart ? INDENT.length : 0
  return {
    text: next,
    selStart: selStart + offset,
    selEnd: selEnd + offset,
  }
}

function handleTabKey(
  textarea: HTMLTextAreaElement,
  e: KeyboardEvent,
  options?: Pick<MermaidTextareaNativeHandlersOptions, 'onValueChange' | 'onDomAuthority'>,
): void {
  const { onValueChange, onDomAuthority } = options ?? {}
  const selStart = textarea.selectionStart
  const selEnd = textarea.selectionEnd
  const text = textarea.value

  if (e.shiftKey) {
    const lineStart = lineStartIndex(text, selStart)
    const { text: next, removed } = outdentLine(text, lineStart)
    if (removed > 0) {
      const delta = selStart - lineStart
      const newStart = Math.max(lineStart, selStart - Math.min(delta, removed))
      const newEnd = Math.max(lineStart, selEnd - Math.min(selEnd - lineStart, removed))
      scheduleValueMutation(textarea, next, newStart, newEnd, onValueChange, onDomAuthority)
    }
    return
  }

  const lineStart = lineStartIndex(text, selStart)
  const { text: next, selStart: newStart, selEnd: newEnd } = indentLine(text, lineStart, selStart, selEnd)
  scheduleValueMutation(textarea, next, newStart, newEnd, onValueChange, onDomAuthority)
}

function onCopy(e: ClipboardEvent): void {
  const ctx = validateInputFocusForEvent(e)
  if (!ctx || isTextareaComposing(ctx.textarea)) return
  runClipboardCopy(ctx.textarea, e)
}

function onCut(
  e: ClipboardEvent,
  onValueChange?: MermaidTextareaNativeHandlersOptions['onValueChange'],
): void {
  const ctx = validateInputFocusForEvent(e)
  if (!ctx || isTextareaComposing(ctx.textarea)) return
  runClipboardCut(ctx.textarea, e, onValueChange)
}

function onKeyDown(
  e: KeyboardEvent,
  options?: Pick<
    MermaidTextareaNativeHandlersOptions,
    'onValueChange' | 'onDomAuthority'
  >,
): void {
  const { onValueChange, onDomAuthority } = options ?? {}
  if (e.isComposing || e.keyCode === 229) return

  const ctx = validateInputFocusForEvent(e)
  if (!ctx || isTextareaComposing(ctx.textarea)) return

  const mod = e.metaKey || e.ctrlKey
  const key = e.key.toLowerCase()

  if (mod && key === 'a') {
    e.preventDefault()
    e.stopPropagation()
    runSelectAll(ctx.textarea)
    return
  }

  if (e.key !== 'Tab') return

  e.preventDefault()
  e.stopPropagation()
  e.stopImmediatePropagation()
  handleTabKey(ctx.textarea, e, { onValueChange, onDomAuthority })
}

function onPaste(
  e: ClipboardEvent,
  options?: Pick<MermaidTextareaNativeHandlersOptions, 'onValueChange' | 'onDomAuthority'>,
): void {
  const { onValueChange, onDomAuthority } = options ?? {}
  const ctx = validateInputFocusForEvent(e)
  if (!ctx || isTextareaComposing(ctx.textarea)) return

  e.preventDefault()
  e.stopPropagation()

  const plain = e.clipboardData?.getData('text/plain') ?? ''
  const ta = ctx.textarea
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const next = ta.value.slice(0, start) + plain + ta.value.slice(end)
  const cursor = start + plain.length
  scheduleValueMutation(ta, next, cursor, cursor, onValueChange, onDomAuthority)
}

function attachCompositionWithFlush(textarea: HTMLTextAreaElement): () => void {
  const detach = attachSelectionCycleComposition(textarea)
  const onEnd = () => scheduleFrameSyncFlush(textarea)
  textarea.addEventListener('compositionend', onEnd)
  return () => {
    textarea.removeEventListener('compositionend', onEnd)
    detach()
  }
}

/**
 * Mermaid source textarea: Selection Cycle v2 frame synchronization pipeline.
 */
export function installMermaidSourceTextareaHandlers(
  textarea: HTMLTextAreaElement,
  options?: MermaidTextareaNativeHandlersOptions,
): () => void {
  const { blockId, onDomAuthority, onValueChange, onPipelineComplete } = options ?? {}

  if (blockId) resetSelectionFrameForBlock(textarea, blockId)

  setPipelineCompleteHook(textarea, onPipelineComplete ?? null)

  const detachComposition = attachCompositionWithFlush(textarea)

  const handlerOpts = { onValueChange, onDomAuthority }
  const keyHandler = (e: KeyboardEvent) => onKeyDown(e, handlerOpts)
  const pasteHandler = (e: ClipboardEvent) => onPaste(e, handlerOpts)
  const copyHandler = (e: ClipboardEvent) => onCopy(e)
  const cutHandler = (e: ClipboardEvent) => onCut(e, onValueChange)

  textarea.addEventListener('keydown', keyHandler, { capture: true })
  textarea.addEventListener('paste', pasteHandler, { capture: true })
  textarea.addEventListener('copy', copyHandler, { capture: true })
  textarea.addEventListener('cut', cutHandler, { capture: true })

  return () => {
    textarea.removeEventListener('keydown', keyHandler, { capture: true })
    textarea.removeEventListener('paste', pasteHandler, { capture: true })
    textarea.removeEventListener('copy', copyHandler, { capture: true })
    textarea.removeEventListener('cut', cutHandler, { capture: true })
    detachComposition()
    detachSelectionCycle(textarea)
  }
}
