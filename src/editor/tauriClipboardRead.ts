import { invoke, isTauri } from '@tauri-apps/api/core'

import { MAX_PASTE_IMAGE_BYTES } from '../app/assets/imagePasteLimits'
import { reportPasteIssue, type PasteIssueCode } from './pasteIssueReporter'

export type TauriClipboardImage = {
  mime_type: string
  data_base64: string
}

export type TauriClipboardImageReadResult = {
  image: TauriClipboardImage | null
  issue: string | null
}

export type ClipboardImagePayload = {
  file: File
  mime: string
}

function dtoToClipboardImage(dto: TauriClipboardImage): ClipboardImagePayload | null {
  if (!dto.data_base64) return null
  const estimatedBytes = Math.floor(dto.data_base64.replace(/\s/gu, '').length * 3 / 4)
  if (estimatedBytes > MAX_PASTE_IMAGE_BYTES) return null
  const binary = atob(dto.data_base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  const mime = dto.mime_type || 'image/png'
  const ext = mime.split('/')[1] || 'png'
  const file = new File([bytes], `paste.${ext}`, { type: mime })
  return { file, mime }
}

function reportClipboardIssue(issue: string | null | undefined): void {
  if (issue === 'heic_unsupported') {
    reportPasteIssue('heic_unsupported')
  }
}

export async function readTauriClipboardText(): Promise<string | null> {
  if (!isTauri()) return null
  try {
    const text = await invoke<string | null>('read_clipboard_text')
    return text && text.length > 0 ? text : null
  } catch {
    return null
  }
}

export async function readTauriClipboardImage(): Promise<ClipboardImagePayload | null> {
  const result = await readTauriClipboardImageResult()
  if (!result || 'issue' in result) return null
  return result
}

export async function readTauriClipboardImageResult(): Promise<
  ClipboardImagePayload | { issue: PasteIssueCode } | null
> {
  if (!isTauri()) return null
  try {
    const dto = await invoke<TauriClipboardImageReadResult>('read_clipboard_image')
    reportClipboardIssue(dto.issue)
    if (dto.issue === 'heic_unsupported') {
      return { issue: 'heic_unsupported' }
    }
    if (!dto.image) return null
    return dtoToClipboardImage(dto.image)
  } catch {
    return null
  }
}
