import { invoke, isTauri } from '@tauri-apps/api/core'

import { MAX_PASTE_IMAGE_BYTES } from '../app/assets/imagePasteLimits'

export type TauriClipboardImage = {
  mime_type: string
  data_base64: string
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

export async function readTauriClipboardImage(): Promise<{ file: File; mime: string } | null> {
  if (!isTauri()) return null
  try {
    const dto = await invoke<TauriClipboardImage | null>('read_clipboard_image')
    if (!dto?.data_base64) return null
    const estimatedBytes = Math.floor(dto.data_base64.replace(/\s/gu, '').length * 3 / 4)
    if (estimatedBytes > MAX_PASTE_IMAGE_BYTES) return null
    const binary = atob(dto.data_base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    const mime = dto.mime_type || 'image/png'
    const ext = mime.split('/')[1] || 'png'
    const file = new File([bytes], `paste.${ext}`, { type: mime })
    return { file, mime }
  } catch {
    return null
  }
}
