import { isTauri } from '@tauri-apps/api/core'
import type { ClipboardEvent } from 'react'

import { plainTextFromClipboardData } from './webviewPasteBridge'
import { readTauriClipboardText } from './tauriClipboardRead'

/** Sync read from paste event clipboardData (plain + html fallback). */
export function readPlainFromBlockSourcePasteEvent(
  clipboardData: DataTransfer | null | undefined,
): string {
  return plainTextFromClipboardData(clipboardData ?? null)
}

/** Falls back to Tauri native clipboard when WKWebView clipboardData is empty. */
export async function readPlainForBlockSourcePaste(
  clipboardData: DataTransfer | null | undefined,
): Promise<string> {
  const fromEvent = readPlainFromBlockSourcePasteEvent(clipboardData)
  if (fromEvent.trim()) return fromEvent
  if (isTauri()) {
    return (await readTauriClipboardText()) ?? ''
  }
  return ''
}

export function insertPlainAtTextareaSelection(
  textarea: HTMLTextAreaElement,
  plain: string,
): string {
  const start = textarea.selectionStart ?? textarea.value.length
  const end = textarea.selectionEnd ?? start
  return `${textarea.value.slice(0, start)}${plain}${textarea.value.slice(end)}`
}

export async function pastePlainIntoBlockSourceTextarea(
  event: ClipboardEvent<HTMLTextAreaElement>,
  applyValue: (next: string) => void,
): Promise<boolean> {
  event.preventDefault()
  event.stopPropagation()

  let plain = readPlainFromBlockSourcePasteEvent(event.clipboardData)
  if (!plain.trim() && isTauri()) {
    plain = (await readTauriClipboardText()) ?? ''
  }
  if (!plain) return false

  applyValue(insertPlainAtTextareaSelection(event.currentTarget, plain))
  return true
}
