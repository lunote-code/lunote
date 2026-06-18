import type { TiptapMarkdownEditorHandle } from '../editor/TiptapMarkdownEditor'
import { computeLeadingFrontmatterPrefixLength } from '../editor/documentFrontmatterOffsets'
import { attachDocumentFrontmatter } from '../editor/documentFrontmatterStore'
import { parseFrontmatter } from '../editor/knowledgeRuntime/wikiLinkParser'
import { getSourceModeIdentity } from '../editor/sourceModeIdentity'
import { setSourceModeIdentity } from '../editor/sourceModeIdentity'
import { applyActiveDocumentContentImmediately } from '../documentRuntime/documentKernel'
import { pathsEqual } from './workspacePathUtils'
import { normalizeLineEndings } from './normalizeLineEndings'

function mergeDetachedFrontmatter(documentKey: string, markdown: string): string {
  if (!documentKey || documentKey === 'scratch') return markdown
  return attachDocumentFrontmatter(documentKey, markdown)
}

/** Ensure visual edit bodies are merged with cached YAML before writing to disk (LF line endings). */
export function diskMarkdownForDocumentSave(path: string, markdown: string): string {
  return normalizeLineEndings(mergeDetachedFrontmatter(path, markdown))
}

/** Split on-disk markdown into visual edit surface vs full source identity. */
export function projectSavedMarkdownToEditorSurfaces(
  mainPaneMode: 'visual' | 'source',
  diskMarkdown: string,
): { editorSurface: string; sourceIdentity: string } {
  if (mainPaneMode !== 'visual') {
    return { editorSurface: diskMarkdown, sourceIdentity: diskMarkdown }
  }
  return { editorSurface: parseFrontmatter(diskMarkdown).body, sourceIdentity: diskMarkdown }
}

/**
 * Align in-memory projections: visual/kernel use edit body; source mode uses full markdown (with YAML).
 */
export function projectDocumentMemorySurfaces(
  path: string,
  markdown: string,
): { editorSurface: string; sourceIdentity: string } {
  const sourceIdentity = diskMarkdownForDocumentSave(path, markdown)
  return { editorSurface: parseFrontmatter(sourceIdentity).body, sourceIdentity }
}

/** PM/body markdown → full source buffer + prefix length for mode-switch coordinate maps. */
export function projectModeSwitchSourceBuffer(
  path: string,
  bodyOrFullMarkdown: string,
): { editorSurface: string; sourceIdentity: string; frontmatterPrefixLength: number } {
  const pmBody = parseFrontmatter(bodyOrFullMarkdown).body
  const sourceIdentity = diskMarkdownForDocumentSave(path, pmBody)
  const editorSurface = parseFrontmatter(sourceIdentity).body
  const frontmatterPrefixLength = computeLeadingFrontmatterPrefixLength(sourceIdentity)
  return { editorSurface, sourceIdentity, frontmatterPrefixLength }
}

function waitForCompositionEnd(visualEditor: TiptapMarkdownEditorHandle): Promise<void> {
  if (typeof visualEditor.waitForCompositionEnd === 'function') {
    return visualEditor.waitForCompositionEnd()
  }
  return Promise.resolve()
}

export function isVisualEditorBoundToDocumentKey(
  visualEditor: TiptapMarkdownEditorHandle | null,
  documentKey: string,
): boolean {
  if (!visualEditor) return false
  return pathsEqual(visualEditor.getBoundDocumentKey(), documentKey)
}

export function canSafelyReadEditorForDocumentKey(
  mainPaneMode: 'visual' | 'source',
  documentKey: string,
  activePath: string | null | undefined,
  visualEditor: TiptapMarkdownEditorHandle | null,
): boolean {
  if (!pathsEqual(activePath ?? '', documentKey)) return false
  if (mainPaneMode !== 'visual') return true
  return isVisualEditorBoundToDocumentKey(visualEditor, documentKey)
}

/**
 * Read markdown for save/flush when the editor must still be bound to `documentKey`.
 * Returns null if the tab or editor binding changed during await (e.g. composition end).
 */
export async function tryResolveBoundEditorMarkdown(
  mainPaneMode: 'visual' | 'source',
  visualEditor: TiptapMarkdownEditorHandle | null,
  kernelContent: string,
  documentKey: string,
  getActivePath: () => string | null | undefined,
): Promise<string | null> {
  if (!canSafelyReadEditorForDocumentKey(mainPaneMode, documentKey, getActivePath(), visualEditor)) {
    return null
  }
  if (mainPaneMode !== 'visual' || !visualEditor) {
    const fromSourceIdentity = getSourceModeIdentity(documentKey)
    return fromSourceIdentity ?? kernelContent
  }
  await waitForCompositionEnd(visualEditor)
  if (!canSafelyReadEditorForDocumentKey(mainPaneMode, documentKey, getActivePath(), visualEditor)) {
    return null
  }
  const markdown =
    typeof visualEditor.flushPendingMarkdownSync === 'function'
      ? visualEditor.flushPendingMarkdownSync(true, false)
      : visualEditor.getMarkdown(true)
  if (!canSafelyReadEditorForDocumentKey(mainPaneMode, documentKey, getActivePath(), visualEditor)) {
    return null
  }
  return mergeDetachedFrontmatter(documentKey, markdown)
}

/** Prefer latest tab cache over snapshots captured before the save queue ran. */
export function resolveSaveBodyFallback(
  pathToSave: string,
  tabBodySnapshot: string | undefined,
  contentSnapshot: string,
  getTabBody: (path: string) => string | undefined,
): string | undefined {
  return getTabBody(pathToSave) ?? tabBodySnapshot ?? contentSnapshot
}

export function resolveActiveAwareSaveBodyFallback(args: {
  pathToSave: string
  tabBodySnapshot: string | undefined
  contentSnapshot: string
  activePath: string | null | undefined
  activeContent: string
  resolveDocumentBody: (path: string, contentFallback?: string) => string | undefined
}): string | undefined {
  const { pathToSave, tabBodySnapshot, contentSnapshot, activePath, activeContent, resolveDocumentBody } = args
  return resolveSaveBodyFallback(pathToSave, tabBodySnapshot, contentSnapshot, (path) =>
    resolveDocumentBody(path, pathsEqual(path, activePath ?? '') ? activeContent : undefined),
  )
}

/** Keep all in-memory document projections aligned around the latest authoritative body. */
export function commitLatestDocumentBodyToMemory(args: {
  path: string
  body: string
  contentRef: { current: string }
  persistBody?: (path: string, body: string) => void
  /** Full on-disk markdown (with YAML). Defaults to `body`. */
  sourceIdentity?: string
}): void {
  const { path, body, contentRef, persistBody, sourceIdentity } = args
  if (!path) return
  persistBody?.(path, body)
  contentRef.current = body
  setSourceModeIdentity(path, sourceIdentity ?? body)
}

/** Mode switch must update the active document snapshot before the next pane mounts. */
export function syncActiveDocumentBodyImmediately(args: {
  path: string
  body: string
  contentRef: { current: string }
  source?: string
  /** When set, `body` is the visual edit surface and this is the full source buffer. */
  sourceIdentity?: string
}): void {
  const { path, body, contentRef, source, sourceIdentity: explicitIdentity } = args
  const projected =
    explicitIdentity != null
      ? { editorSurface: body, sourceIdentity: explicitIdentity }
      : projectDocumentMemorySurfaces(path, body)
  commitLatestDocumentBodyToMemory({
    path,
    body: projected.editorSurface,
    sourceIdentity: projected.sourceIdentity,
    contentRef,
  })
  applyActiveDocumentContentImmediately(path, projected.editorSurface, source)
}

/** Get the editor's true value before saving/cutting tabs: Visual forces flush PM, and Source uses kernel content.*/
export async function resolveMarkdownForSave(
  mainPaneMode: 'visual' | 'source',
  visualEditor: TiptapMarkdownEditorHandle | null,
  kernelContent: string,
  documentKey?: string,
): Promise<string> {
  if (mainPaneMode === 'visual' && visualEditor) {
    if (documentKey && !isVisualEditorBoundToDocumentKey(visualEditor, documentKey)) {
      return kernelContent
    }
    await waitForCompositionEnd(visualEditor)
    if (documentKey && !isVisualEditorBoundToDocumentKey(visualEditor, documentKey)) {
      return kernelContent
    }
    let markdown: string
    if (typeof visualEditor.flushPendingMarkdownSync === 'function') {
      markdown = visualEditor.flushPendingMarkdownSync(true, false)
    } else {
      markdown = visualEditor.getMarkdown(true)
    }
    if (documentKey) {
      return mergeDetachedFrontmatter(documentKey, markdown)
    }
    return markdown
  }
  return kernelContent
}
