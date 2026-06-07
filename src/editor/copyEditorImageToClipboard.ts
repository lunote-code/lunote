import type { Editor } from '@tiptap/core'
import type { Node as PmNode } from '@tiptap/pm/model'
import { NodeSelection } from '@tiptap/pm/state'

import {
  filePathFromFileUrl,
  isAbsoluteLocalMediaPath,
  isBlockedMediaScheme,
  isExternalOrDataSrc,
  isFileMediaUrl,
  resolveMarkdownMediaSrc,
} from '../export/mediaSources'
import { isPathUnderWorkspace, joinRelativePath, normPath, parentDirectoryOfFile, pathHasParentDirSegment } from '../lib/workspacePathUtils'
import { readWorkspaceFileBase64 } from '../platform/tauri/documentService'
import { isEmbeddedVideoSrc } from './lunaImage'

export type ImageCopyTarget = {
  src: string
  alt: string
  title: string | null
}

export type CopyEditorImageContext = {
  rootDir: string
  activePath: string
  clientCoords?: { x: number; y: number }
}

function attrsFromImageNode(node: PmNode): ImageCopyTarget | null {
  if (node.type.name !== 'image') return null
  const src = String(node.attrs.src ?? '').trim()
  if (!src || isEmbeddedVideoSrc(src)) return null
  return {
    src,
    alt: String(node.attrs.alt ?? ''),
    title: node.attrs.title != null ? String(node.attrs.title) : null,
  }
}

function findImageAtResolvedPos(doc: PmNode, pos: number): ImageCopyTarget | null {
  const $pos = doc.resolve(Math.max(1, Math.min(pos, doc.content.size)))
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const hit = attrsFromImageNode($pos.node(depth))
    if (hit) return hit
  }
  const after = $pos.nodeAfter
  if (after) {
    const hit = attrsFromImageNode(after)
    if (hit) return hit
  }
  const before = $pos.nodeBefore
  if (before) {
    const hit = attrsFromImageNode(before)
    if (hit) return hit
  }
  return null
}

export function getImageCopyTargetFromEditor(
  editor: Editor,
  clientCoords?: { x: number; y: number },
): ImageCopyTarget | null {
  const { selection, doc } = editor.state
  if (selection instanceof NodeSelection) {
    return attrsFromImageNode(selection.node)
  }

  if (clientCoords) {
    const hit = editor.view.posAtCoords({ left: clientCoords.x, top: clientCoords.y })
    if (hit) {
      const atPointer = findImageAtResolvedPos(doc, hit.pos)
      if (atPointer) return atPointer
    }
  }

  const { from, to } = selection
  let found: ImageCopyTarget | null = null
  doc.nodesBetween(from, to, (node) => {
    if (found) return false
    const hit = attrsFromImageNode(node)
    if (hit) {
      found = hit
      return false
    }
    return true
  })
  return found
}

function resolveWorkspaceImageFilePath(rootDir: string, notePath: string, src: string): string | null {
  const trimmed = src.trim()
  if (!trimmed || isBlockedMediaScheme(trimmed) || isEmbeddedVideoSrc(trimmed)) return null
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
  const noteAbs = normPath(notePath).startsWith('/') || /^[A-Za-z]:\//u.test(notePath)
    ? normPath(notePath)
    : joinRelativePath(rootNorm, notePath)
  if (!isPathUnderWorkspace(rootNorm, noteAbs)) return null
  const absolute = joinRelativePath(parentDirectoryOfFile(noteAbs), trimmed.replace(/^\.\//u, ''))
  return isPathUnderWorkspace(rootNorm, absolute) ? absolute : null
}

function guessImageMime(fileNameOrPath: string, blobType?: string): string {
  if (blobType && blobType.startsWith('image/')) return blobType
  const ext = (fileNameOrPath.split('.').pop() ?? '').toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'svg') return 'image/svg+xml'
  return 'image/png'
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function markdownImageSnippet(target: ImageCopyTarget): string {
  const alt = target.alt.replace(/\\/gu, '\\\\').replace(/\[/gu, '\\[').replace(/\]/gu, '\\]')
  const base = `![${alt}](${target.src})`
  if (target.title?.trim()) {
    const title = target.title.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"')
    return `${base} "${title}"`
  }
  return base
}

async function blobFromImageTarget(
  target: ImageCopyTarget,
  ctx: CopyEditorImageContext,
): Promise<Blob | null> {
  const raw = target.src.trim()
  if (!raw) return null

  if (raw.startsWith('data:')) {
    try {
      const res = await fetch(raw)
      if (!res.ok) return null
      return res.blob()
    } catch {
      return null
    }
  }

  if (/^https?:\/\//iu.test(raw)) {
    try {
      const res = await fetch(raw)
      if (!res.ok) return null
      return res.blob()
    } catch {
      return null
    }
  }

  if (ctx.rootDir && ctx.activePath) {
    const workspacePath = resolveWorkspaceImageFilePath(ctx.rootDir, ctx.activePath, raw)
    if (workspacePath) {
      try {
        const b64 = await readWorkspaceFileBase64(ctx.rootDir, workspacePath)
        const mime = guessImageMime(workspacePath)
        return base64ToBlob(b64, mime)
      } catch {
        return null
      }
    }
  }

  const displaySrc = resolveMarkdownMediaSrc(raw, ctx.activePath || null, {
    rootDir: ctx.rootDir || null,
  })
  if (displaySrc && displaySrc !== raw) {
    try {
      const res = await fetch(displaySrc)
      if (res.ok) return res.blob()
    } catch {
      return null
    }
  }

  return null
}

async function writeImageBlobToClipboard(blob: Blob, plainFallback: string): Promise<boolean> {
  const mime = guessImageMime('', blob.type)
  const normalized =
    blob.type && blob.type.startsWith('image/') ? blob : new Blob([await blob.arrayBuffer()], { type: mime })

  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      const item: Record<string, Blob> = { [normalized.type]: normalized }
      item['text/plain'] = new Blob([plainFallback], { type: 'text/plain' })
      await navigator.clipboard.write([new ClipboardItem(item)])
      return true
    } catch {
      /* fall through */
    }
  }

  try {
    await navigator.clipboard.writeText(plainFallback)
    return false
  } catch {
    return false
  }
}

/** Copy a resolved editor image (pixels when possible) to the system clipboard. */
export async function copyEditorImageToClipboard(
  editor: Editor,
  ctx: CopyEditorImageContext,
): Promise<boolean> {
  const target = getImageCopyTargetFromEditor(editor, ctx.clientCoords)
  if (!target) return false

  const blob = await blobFromImageTarget(target, ctx)
  if (!blob || blob.size === 0) return false

  const plain = markdownImageSnippet(target)
  return writeImageBlobToClipboard(blob, plain)
}
