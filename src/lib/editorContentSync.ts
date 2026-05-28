import type { TiptapMarkdownEditorHandle } from '../editor/TiptapMarkdownEditor'
import { getSourceModeIdentity } from '../editor/sourceModeIdentity'
import { pathsEqual } from './workspacePathUtils'

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
      ? visualEditor.flushPendingMarkdownSync()
      : visualEditor.getMarkdown()
  if (!canSafelyReadEditorForDocumentKey(mainPaneMode, documentKey, getActivePath(), visualEditor)) {
    return null
  }
  return markdown
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
    if (typeof visualEditor.flushPendingMarkdownSync === 'function') {
      return visualEditor.flushPendingMarkdownSync()
    }
    return visualEditor.getMarkdown()
  }
  return kernelContent
}
