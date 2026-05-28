import {
  clipboardTextFromStable,
  ensureStableSnapshot,
  runSelectAll,
} from '../nativeInput/selectionCycle/v2'
import { isTextareaComposing } from '../nativeInput/selectionCycle'
import { MERMAID_SOURCE_PORTAL_CLASS } from './MermaidSourceSession'
import { validateInputFocusForEvent } from './mermaidSourceInputFocus'

export function isMermaidSourcePortalTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return false
  const el = target instanceof HTMLElement ? target : target.parentElement
  return !!el?.closest(`.${MERMAID_SOURCE_PORTAL_CLASS}, .pm-mermaid-source-panel, .code-block-input`)
}

function isMermaidSourceTextarea(target: EventTarget | null): boolean {
  return target instanceof HTMLTextAreaElement && !!target.dataset.mermaidBlockId
}

export function selectAllMermaidBlockFromEvent(event: KeyboardEvent): boolean {
  const ctx = validateInputFocusForEvent(event)
  if (!ctx) return false
  runSelectAll(ctx.textarea)
  return true
}

/** The document flow textarea is handled by capture; the portal uses StableSnapshot for covert purposes.*/
export function handleMermaidCopy(event: ClipboardEvent): boolean {
  if (isMermaidSourceTextarea(event.target)) return false

  const ctx = validateInputFocusForEvent(event)
  if (!ctx || isTextareaComposing(ctx.textarea)) return false

  const snapshot = ensureStableSnapshot(ctx.textarea)
  event.preventDefault()
  event.stopPropagation()
  event.clipboardData?.setData('text/plain', clipboardTextFromStable(snapshot))
  return true
}

export function handleMermaidCut(event: ClipboardEvent): boolean {
  if (isMermaidSourceTextarea(event.target)) return false

  const ctx = validateInputFocusForEvent(event)
  if (!ctx || isTextareaComposing(ctx.textarea)) return false

  const snapshot = ensureStableSnapshot(ctx.textarea)
  event.preventDefault()
  event.stopPropagation()
  event.clipboardData?.setData('text/plain', clipboardTextFromStable(snapshot))
  ctx.textarea.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}

export function installMermaidClipboardCapture(root: HTMLElement): () => void {
  const onCopy = (e: ClipboardEvent) => {
    handleMermaidCopy(e)
  }
  const onCut = (e: ClipboardEvent) => {
    handleMermaidCut(e)
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (!isMermaidSourcePortalTarget(e.target)) return
    if (isMermaidSourceTextarea(e.target)) return
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key.toLowerCase() === 'a') {
      if (selectAllMermaidBlockFromEvent(e)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
  }

  root.addEventListener('copy', onCopy, true)
  root.addEventListener('cut', onCut, true)
  root.addEventListener('keydown', onKeyDown, true)
  return () => {
    root.removeEventListener('copy', onCopy, true)
    root.removeEventListener('cut', onCut, true)
    root.removeEventListener('keydown', onKeyDown, true)
  }
}
