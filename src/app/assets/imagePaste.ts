import { computeAssetIndexRelativePath } from '../../assets/assetDisplayPath'
import { resolveAssetStoragePath } from '../../assets/assetStorageResolver'
import type { AssetStorageConfig } from '../../assets/assetStoragePolicy'
import { normalizeAssetStorageConfig } from '../../assets/assetStoragePolicy'
import { documentIO } from '../../io/documentIO'
import { noteAssetExists } from '../../platform/tauri/documentService'
import {
  canInlinePasteWithoutWorkspace,
  isPasteImageTooLarge,
  MAX_INLINE_PASTE_IMAGE_BYTES,
  MAX_PASTE_IMAGE_BYTES,
} from './imagePasteLimits'

export function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)))
  }
  return btoa(binary)
}

export function extForMime(mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes('png')) return 'png'
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg'
  if (m.includes('webp')) return 'webp'
  if (m.includes('gif')) return 'gif'
  if (m.includes('svg')) return 'svg'
  return 'png'
}

export async function savePastedImageAsset(
  file: File,
  mimeHint: string,
  getCtx: () => { rootDir: string; activePath: string; assetStorage: AssetStorageConfig },
  report: (key: string, vars?: Record<string, string | number>) => void,
): Promise<string | null> {
  const { rootDir, activePath, assetStorage } = getCtx()
  const storageConfig = normalizeAssetStorageConfig(assetStorage)
  if (file.size > MAX_PASTE_IMAGE_BYTES) {
    report('app.paste.imageSaveFailed', {
      message: `image exceeds ${MAX_PASTE_IMAGE_BYTES / (1024 * 1024)}MB limit`,
    })
    return null
  }
  const buf = await file.arrayBuffer()
  const mime = mimeHint || file.type || 'image/png'
  if (buf.byteLength < 16) {
    report('app.paste.imageSaveFailed', { message: 'empty image' })
    return null
  }
  if (isPasteImageTooLarge(buf.byteLength)) {
    report('app.paste.imageSaveFailed', {
      message: `image exceeds ${MAX_PASTE_IMAGE_BYTES / (1024 * 1024)}MB limit`,
    })
    return null
  }

  async function inlineDataUrl(): Promise<string> {
    const b64 = bytesToBase64(buf)
    return `data:${mime};base64,${b64}`
  }

  if (!rootDir || !activePath) {
    if (!canInlinePasteWithoutWorkspace(buf.byteLength)) {
      report('app.paste.imageNeedSavedDoc')
      return null
    }
    return inlineDataUrl()
  }
  try {
    const b64 = bytesToBase64(buf)
    const targetDir = resolveAssetStoragePath({
      mode: storageConfig.mode,
      documentPath: activePath,
      absolutePath: storageConfig.absolutePath,
      relativeFolderName: storageConfig.relativeFolderName,
    })
    const ext = extForMime(mimeHint || file.type)
    const digest = await (async () => {
      const hash = await crypto.subtle.digest('SHA-256', buf)
      const bytes = new Uint8Array(hash)
      let hex = ''
      for (let i = 0; i < bytes.length; i += 1) hex += bytes[i]!.toString(16).padStart(2, '0')
      return hex.slice(0, 16)
    })()
    const name = `paste-${digest}.${ext}`
    const relativePath = computeAssetIndexRelativePath(
      targetDir,
      name,
      activePath,
      storageConfig,
      rootDir,
    )
    await documentIO.copyAssetFile({ root: rootDir, path: activePath, relativePath, dataBase64: b64 })
    try {
      const exists = await noteAssetExists(rootDir, activePath, relativePath)
      if (!exists) {
        report('app.paste.imageSaveFailed', { message: 'asset missing after save' })
        if (buf.byteLength <= MAX_INLINE_PASTE_IMAGE_BYTES) return inlineDataUrl()
        return null
      }
    } catch {
      /* proceed with relative path */
    }
    report('app.paste.imageSaved')
    return relativePath.startsWith('./') ? relativePath : `./${relativePath}`
  } catch (e) {
    report('app.paste.imageSaveFailed', { message: String(e) })
    if (buf.byteLength <= MAX_INLINE_PASTE_IMAGE_BYTES) {
      try {
        return await inlineDataUrl()
      } catch {
        return null
      }
    }
    return null
  }
}
