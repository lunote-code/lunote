import { convertFileSrc, isTauri } from '@tauri-apps/api/core'
import {
  isPathUnderWorkspace,
  joinRelativePath,
  normPath,
  parentDirectoryOfFile,
  pathHasParentDirSegment,
  resolvePathRelativeToDirectory,
} from '../lib/workspacePathUtils'

export type MediaSourceResolveOptions = {
  preferFileUrl?: boolean
  rootDir?: string | null
}

const BLOCKED_MEDIA_SCHEMES = ['note:'] as const

export function isBlockedMediaScheme(src: string): boolean {
  const trimmed = src.trim().toLowerCase()
  return BLOCKED_MEDIA_SCHEMES.some((scheme) => trimmed.startsWith(scheme))
}

export function isFileMediaUrl(src: string): boolean {
  return /^file:/iu.test(src.trim())
}

export function isAbsoluteLocalMediaPath(src: string): boolean {
  const trimmed = src.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('//')) return false
  return trimmed.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(trimmed) || trimmed.startsWith('\\\\')
}

export function isExternalOrDataSrc(src: string): boolean {
  if (isBlockedMediaScheme(src)) return true
  return /^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/iu.test(src)
}

/** Resolves a local path from a file:// URL; returns null if it cannot be resolved or contains `..`*/
export function filePathFromFileUrl(url: string): string | null {
  const trimmed = url.trim()
  if (!isFileMediaUrl(trimmed)) return null
  const withoutScheme = trimmed.replace(/^file:\/\/+/iu, '').replace(/^file:/iu, '')
  try {
    if (pathHasParentDirSegment(decodeURIComponent(withoutScheme))) return null
  } catch {
    return null
  }
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'file:') return null
    let path = decodeURIComponent(parsed.pathname)
    if (/^\/[A-Za-z]:/u.test(path)) path = path.slice(1)
    if (pathHasParentDirSegment(path)) return null
    return normPath(path)
  } catch {
    return null
  }
}

function parentDir(path: string): string {
  return parentDirectoryOfFile(path.replace(/\\/g, '/'))
}

function fileUrl(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const prefix = normalized.startsWith('/') ? 'file://' : 'file:///'
  return `${prefix}${normalized.split('/').map(encodeURIComponent).join('/')}`
}

function resolveToDisplayUrl(absolute: string, opts: MediaSourceResolveOptions): string {
  if (opts.preferFileUrl) return fileUrl(absolute)
  return isTauri() ? convertFileSrc(absolute) : fileUrl(absolute)
}

export function buildMediaSourceResolveOptions(
  rootDir: string | null | undefined,
  extra?: Pick<MediaSourceResolveOptions, 'preferFileUrl'>,
): MediaSourceResolveOptions {
  return {
    ...extra,
    rootDir: rootDir ?? null,
  }
}

export function resolveMarkdownMediaSrc(
  src: string | null | undefined,
  sourcePath: string | null | undefined,
  opts: MediaSourceResolveOptions = {},
): string {
  const raw = String(src ?? '').trim()
  if (!raw || isBlockedMediaScheme(raw)) return raw

  if (isFileMediaUrl(raw)) {
    const absolute = filePathFromFileUrl(raw)
    if (!absolute) return raw
    return resolveToDisplayUrl(absolute, opts)
  }

  if (isAbsoluteLocalMediaPath(raw)) {
    if (pathHasParentDirSegment(raw)) return raw
    return resolveToDisplayUrl(normPath(raw), opts)
  }

  if (isExternalOrDataSrc(raw) || !sourcePath) return raw

  const rootNorm = opts.rootDir ? normPath(opts.rootDir) : null
  const noteNorm = normPath(sourcePath)
  let noteBaseDir: string
  if (rootNorm) {
    const noteAbs =
      noteNorm.startsWith('/') || /^[A-Za-z]:\//u.test(noteNorm)
        ? noteNorm
        : joinRelativePath(rootNorm, noteNorm)
    if (!isPathUnderWorkspace(rootNorm, noteAbs)) return raw
    noteBaseDir = parentDirectoryOfFile(noteAbs)
  } else {
    if (pathHasParentDirSegment(noteNorm)) return raw
    noteBaseDir = parentDir(sourcePath)
  }

  const absolute = resolvePathRelativeToDirectory(noteBaseDir, raw)
  if (rootNorm && !isPathUnderWorkspace(rootNorm, absolute)) return raw

  return resolveToDisplayUrl(absolute, opts)
}

export function rewriteRelativeMediaSources(
  root: ParentNode,
  sourcePath: string | null | undefined,
  opts: MediaSourceResolveOptions = {},
): void {
  if (!sourcePath) return
  root.querySelectorAll('img[src], video[src], source[src]').forEach((node) => {
    const el = node as HTMLImageElement | HTMLVideoElement | HTMLSourceElement
    const src = el.getAttribute('src')
    if (!src || isBlockedMediaScheme(src)) return
    if (isExternalOrDataSrc(src) && !isFileMediaUrl(src)) return
    el.setAttribute('data-luna-original-src', src)
    el.setAttribute('src', resolveMarkdownMediaSrc(src, sourcePath, opts))
  })
}
