import { absolutePathToDocKey } from './knowledgeRuntime/vaultRuntime'
import {
  isPathUnderWorkspace,
  joinRelativePath,
  normPath,
  parentDirectoryOfFile,
  relativePathUnderRoot,
  resolvePathRelativeToDirectory,
} from '../lib/workspacePathUtils'

export type EmbeddedHtmlSameDocHashTarget = {
  kind: 'same-doc-hash'
  fragment: string
}

export type EmbeddedHtmlWorkspaceNoteTarget = {
  kind: 'workspace-note'
  absolutePath: string
  relativePath: string
  docKey: string
  fragment?: string
}

export type ResolvedWorkspaceMarkdownHref = EmbeddedHtmlSameDocHashTarget | EmbeddedHtmlWorkspaceNoteTarget

const BLOCKED_HREF_PREFIXES = ['javascript:', 'data:', 'vbscript:', 'note:', 'file:'] as const

function isAbsoluteNotePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:\//u.test(path)
}

function splitHrefPathAndFragment(href: string): { pathPart: string; fragment: string } {
  const hashIdx = href.indexOf('#')
  if (hashIdx < 0) return { pathPart: href, fragment: '' }
  const pathPart = href.slice(0, hashIdx)
  let fragment: string
  try {
    fragment = decodeURIComponent(href.slice(hashIdx + 1)).trim()
  } catch {
    fragment = href.slice(hashIdx + 1).trim()
  }
  return { pathPart, fragment }
}

function docKeyFromAbsolutePath(rootDir: string, absolutePath: string): string {
  return absolutePathToDocKey(rootDir, absolutePath)
}

/** Resolve `<a href>` inside embedded HTML blocks to workspace notes or same-doc anchors. */
export function resolveWorkspaceMarkdownHref(
  href: string,
  notePath: string,
  rootDir: string,
): ResolvedWorkspaceMarkdownHref | null {
  const trimmed = href.trim()
  if (!trimmed) return null

  const lower = trimmed.toLowerCase()
  if (BLOCKED_HREF_PREFIXES.some((prefix) => lower.startsWith(prefix))) return null
  if (/^[a-z][a-z0-9+.-]*:/iu.test(trimmed)) return null

  const { pathPart, fragment } = splitHrefPathAndFragment(trimmed)
  if (!pathPart) {
    return fragment ? { kind: 'same-doc-hash', fragment } : null
  }

  const noteNorm = normPath(notePath)
  if (!noteNorm) return null

  const rootNorm = normPath(rootDir)
  const noteAbs = isAbsoluteNotePath(noteNorm)
    ? noteNorm
    : rootNorm
      ? joinRelativePath(rootNorm, noteNorm)
      : noteNorm

  if (rootNorm && !isPathUnderWorkspace(rootNorm, noteAbs)) return null

  const absolute = resolvePathRelativeToDirectory(parentDirectoryOfFile(noteAbs), pathPart)
  if (rootNorm && !isPathUnderWorkspace(rootNorm, absolute)) return null

  const relativePath = rootNorm ? (relativePathUnderRoot(rootNorm, absolute) ?? pathPart) : absolute
  const docKey = rootNorm
    ? docKeyFromAbsolutePath(rootNorm, absolute)
    : absolute.replace(/\.md$/iu, '')

  return {
    kind: 'workspace-note',
    absolutePath: absolute,
    relativePath,
    docKey,
    ...(fragment ? { fragment } : {}),
  }
}

export function isEmbeddedHtmlLinkSurface(anchor: HTMLElement): boolean {
  return Boolean(anchor.closest('.pm-luna-html-block-surface, .pm-luna-raw-inline-surface'))
}
