import {
  filePathFromFileUrl,
  isAbsoluteLocalMediaPath,
  isBlockedMediaScheme,
  isExternalOrDataSrc,
  isFileMediaUrl,
  resolveMarkdownMediaSrc,
} from './mediaSources'
import {
  isPathUnderWorkspace,
  joinRelativePath,
  normPath,
  parentDirectoryOfFile,
  pathHasParentDirSegment,
} from '../lib/workspacePathUtils'
import { readWorkspaceFileBase64 } from '../platform/tauri/documentService'
import { isWorkspaceImageEncryptionEnabled } from '../workspace/workspaceImageEncryptionRuntime'

declare global {
  interface Window {
    __LUNA_TEST_WORKSPACE_MEDIA_DECRYPT__?: boolean
  }
}

const VIDEO_PATH_RE = /\.(mp4|webm|ogv|ogg|mov|m4v)(\?|#|$)/i

type BlobCacheEntry = {
  url: string
  refs: number
}

const blobUrlCache = new Map<string, BlobCacheEntry>()
let readWorkspaceFileBase64Override: ((root: string, path: string) => Promise<string>) | null = null

export function isWorkspaceMediaDecryptEnabled(): boolean {
  if (typeof window !== 'undefined' && window.__LUNA_TEST_WORKSPACE_MEDIA_DECRYPT__ === true) {
    return true
  }
  return isWorkspaceImageEncryptionEnabled()
}

/** @internal test helper */
export function setReadWorkspaceFileBase64OverrideForTests(
  reader: ((root: string, path: string) => Promise<string>) | null,
): void {
  readWorkspaceFileBase64Override = reader
}

async function readWorkspaceBinaryBase64(rootDir: string, absolutePath: string): Promise<string> {
  const reader = readWorkspaceFileBase64Override ?? readWorkspaceFileBase64
  return reader(rootDir, absolutePath)
}

function cacheKey(root: string, absolutePath: string): string {
  return `${normPath(root)}\0${normPath(absolutePath)}`
}

export function isWorkspaceEmbeddedVideoSrc(src: string | null | undefined): boolean {
  if (!src) return false
  const trimmed = String(src).trim()
  if (/^data:video\//i.test(trimmed)) return true
  const pathOnly = trimmed.split(/[?#]/u)[0] || trimmed
  return VIDEO_PATH_RE.test(pathOnly)
}

export function resolveWorkspaceMediaFilePath(
  rootDir: string,
  notePath: string,
  src: string,
): string | null {
  const trimmed = src.trim()
  if (!trimmed || isBlockedMediaScheme(trimmed) || isWorkspaceEmbeddedVideoSrc(trimmed)) return null
  if (isExternalOrDataSrc(trimmed) && !isFileMediaUrl(trimmed) && !trimmed.startsWith('data:')) {
    return null
  }

  if (isFileMediaUrl(trimmed)) {
    const absolute = filePathFromFileUrl(trimmed)
    if (!absolute) return null
    return isPathUnderWorkspace(rootDir, absolute) ? absolute : null
  }

  if (isAbsoluteLocalMediaPath(trimmed)) {
    if (pathHasParentDirSegment(trimmed)) return null
    const absolute = normPath(trimmed)
    return isPathUnderWorkspace(rootDir, absolute) ? absolute : null
  }

  const rootNorm = normPath(rootDir)
  const noteAbs =
    normPath(notePath).startsWith('/') || /^[A-Za-z]:\//u.test(notePath)
      ? normPath(notePath)
      : joinRelativePath(rootNorm, notePath)
  if (!isPathUnderWorkspace(rootNorm, noteAbs)) return null
  const absolute = joinRelativePath(parentDirectoryOfFile(noteAbs), trimmed.replace(/^\.\//u, ''))
  return isPathUnderWorkspace(rootNorm, absolute) ? absolute : null
}

export function guessWorkspaceMediaMime(fileNameOrPath: string, blobType?: string): string {
  if (blobType && blobType.startsWith('image/')) return blobType
  const ext = (fileNameOrPath.split('.').pop() ?? '').toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'svg') return 'image/svg+xml'
  return 'image/png'
}

export function base64ToBlob(base64: string, mime: string): Blob {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  return new Blob([bytes], { type: mime })
}

const MARKDOWN_IMAGE_SRC_RE = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu

/** Relative workspace image paths referenced in markdown body (excludes http/data/absolute). */
export function extractWorkspaceRelativeImagePaths(markdown: string): string[] {
  const paths: string[] = []
  const seen = new Set<string>()
  for (const match of markdown.matchAll(MARKDOWN_IMAGE_SRC_RE)) {
    const src = match[1]?.trim() ?? ''
    if (!src || seen.has(src)) continue
    if (isExternalOrDataSrc(src) || isAbsoluteLocalMediaPath(src)) continue
    if (isWorkspaceEmbeddedVideoSrc(src)) continue
    seen.add(src)
    paths.push(src)
  }
  return paths
}

async function readWorkspaceBinaryIntoObjectUrl(
  rootDir: string,
  absolutePath: string,
): Promise<string | null> {
  const key = cacheKey(rootDir, absolutePath)
  const cached = blobUrlCache.get(key)
  if (cached) {
    cached.refs += 1
    return cached.url
  }
  try {
    const b64 = await readWorkspaceBinaryBase64(rootDir, absolutePath)
    const url = URL.createObjectURL(
      base64ToBlob(b64, guessWorkspaceMediaMime(absolutePath)),
    )
    blobUrlCache.set(key, { url, refs: 1 })
    return url
  } catch {
    return null
  }
}

/** Start decrypting workspace images in parallel while the editor hydrates (QA test mode only). */
export function prefetchWorkspaceImagesFromMarkdown(
  rootDir: string,
  notePath: string,
  markdown: string,
): void {
  if (!isWorkspaceMediaDecryptEnabled()) return
  for (const src of extractWorkspaceRelativeImagePaths(markdown)) {
    const absolutePath = resolveWorkspaceMediaFilePath(rootDir, notePath, src)
    if (!absolutePath) continue
    void acquireWorkspaceImageObjectUrl(rootDir, absolutePath)
  }
}

export async function acquireWorkspaceImageObjectUrl(
  rootDir: string,
  absolutePath: string,
): Promise<string | null> {
  if (!isWorkspaceMediaDecryptEnabled()) return null
  return readWorkspaceBinaryIntoObjectUrl(rootDir, absolutePath)
}

/** Lazy fallback when asset protocol cannot serve legacy encrypted blobs (post-unlock IPC decrypt). */
export async function acquireLegacyEncryptedWorkspaceImageObjectUrl(
  rootDir: string,
  absolutePath: string,
): Promise<string | null> {
  return readWorkspaceBinaryIntoObjectUrl(rootDir, absolutePath)
}

export async function readWorkspaceImageBlobPreferAsset(
  rootDir: string,
  notePath: string,
  src: string,
): Promise<Blob | null> {
  const absolutePath = resolveWorkspaceMediaFilePath(rootDir, notePath, src)
  if (!absolutePath) return null
  const displaySrc = resolveMarkdownMediaSrc(src, notePath, { rootDir })
  if (displaySrc) {
    try {
      const res = await fetch(displaySrc)
      if (res.ok) return res.blob()
    } catch {
      /* fall through to IPC read for legacy encrypted assets */
    }
  }
  try {
    const b64 = await readWorkspaceBinaryBase64(rootDir, absolutePath)
    return base64ToBlob(b64, guessWorkspaceMediaMime(absolutePath))
  } catch {
    return null
  }
}

export async function readWorkspaceImageBase64PreferAsset(
  rootDir: string,
  notePath: string,
  src: string,
): Promise<string | null> {
  const blob = await readWorkspaceImageBlobPreferAsset(rootDir, notePath, src)
  if (!blob) return null
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

export function releaseWorkspaceImageObjectUrl(rootDir: string, absolutePath: string): void {
  const key = cacheKey(rootDir, absolutePath)
  const cached = blobUrlCache.get(key)
  if (!cached) return
  cached.refs -= 1
  if (cached.refs <= 0) {
    URL.revokeObjectURL(cached.url)
    blobUrlCache.delete(key)
  }
}

export function clearAllWorkspaceImageObjectUrls(): void {
  for (const entry of blobUrlCache.values()) {
    URL.revokeObjectURL(entry.url)
  }
  blobUrlCache.clear()
}

/** @internal test helper */
export function resetWorkspaceImageObjectUrlCacheForTests(): void {
  clearAllWorkspaceImageObjectUrls()
  readWorkspaceFileBase64Override = null
}
