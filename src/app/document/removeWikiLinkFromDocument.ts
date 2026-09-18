import {
  attachDocumentFrontmatter,
  syncDocumentFrontmatterFromMarkdown,
} from '../../editor/documentFrontmatterStore'
import { docKeyToAbsolutePath } from '../../editor/knowledgeOS'
import { removeWikiLinkFromMarkdownBody } from '../../editor/knowledgeOS/graphLinkRemovalRuntime'
import { notifyKnowledgeDocumentSave } from '../../editor/knowledgeOS/ui/knowledgeAppIntegration'
import { parseFrontmatter } from '../../editor/knowledgeRuntime/wikiLinkParser'
import {
  getDocumentAuthorityProjection,
  resolveLatestDocumentBody,
} from '../../documentRuntime/documentAuthority'
import { commitOpenDocumentMemorySurfaces } from './commitOpenDocumentMemorySurfaces'
import { getTabBody } from './tabBodiesStore'
import { projectDocumentMemorySurfaces } from '../../lib/editorContentSync'
import { pathsEqual } from '../../lib/workspacePathUtils'
import {
  persistClosedDocumentWithConflictGuardAndEncryptionRetry,
  persistOpenDocumentWithEncryptionRetry,
  readClosedDocumentWithEncryptionRetry,
} from '../../workspace/encryptedDocumentSave'
import type { WorkspacePasswordPrompt } from '../../workspace/workspaceEncryptionRuntime'

export async function removeWikiLinkFromDocument(args: {
  rootDir: string
  getCurrentRootDir?: () => string
  promptWorkspacePassword?: WorkspacePasswordPrompt
  sourceDocKey: string
  targetDocKey: string
  heading?: string
  kind?: 'link' | 'embed'
  start?: number
  end?: number
  activePath: string | null
  contentRef: { current: string }
  readDocument?: (root: string, path: string) => Promise<string>
  flushActiveVisualMarkdown?: () => string | null
  onConflict?: (path: string, local: string) => Promise<void> | void
  onWriteError?: (message: string) => void
  t?: (key: string, params?: Record<string, string | number>) => string
}): Promise<boolean> {
  const {
    rootDir,
    getCurrentRootDir,
    promptWorkspacePassword,
    sourceDocKey,
    targetDocKey,
    heading,
    kind,
    start,
    end,
    activePath,
    contentRef,
    readDocument,
    flushActiveVisualMarkdown,
    onConflict,
    onWriteError,
    t = (key) => key,
  } = args
  const rootAtRequest = rootDir.replace(/[/\\]+$/u, '')
  const absolutePath = docKeyToAbsolutePath(sourceDocKey, rootDir)
  if (!absolutePath) return false

  const authority = getDocumentAuthorityProjection()
  const isActive = pathsEqual(activePath ?? '', absolutePath)
  const isOpen =
    isActive ||
    authority.runtime.openedTabs.some((tabPath) => pathsEqual(tabPath, absolutePath))

  let currentFull: string | undefined
  if (isOpen) {
    if (isActive) {
      const flushed = flushActiveVisualMarkdown?.()
      if (flushed != null) {
        currentFull = attachDocumentFrontmatter(absolutePath, flushed)
      }
    }
    currentFull ??= resolveLatestDocumentBody(absolutePath, {
      projection: authority,
      contentFallback: contentRef.current,
    })
  } else if (readDocument) {
    currentFull =
      (await readClosedDocumentWithEncryptionRetry({
        rootAtRequest,
        getCurrentRootDir: getCurrentRootDir ?? (() => rootDir),
        path: absolutePath,
        allowUnlockRetry: true,
        promptWorkspacePassword,
        t,
        readDocument,
      })) ?? undefined
  } else {
    const cachedBody = getTabBody(absolutePath)
    if (cachedBody !== undefined) {
      currentFull = attachDocumentFrontmatter(absolutePath, cachedBody)
    }
  }
  if (!currentFull) return false

  const { body } = parseFrontmatter(currentFull)
  const nextBody = removeWikiLinkFromMarkdownBody(body, targetDocKey, { heading, kind, start, end })
  if (nextBody === body) return false

  const full = attachDocumentFrontmatter(absolutePath, nextBody)
  const projected = projectDocumentMemorySurfaces(absolutePath, full)

  const saveBaseOptions = {
    rootAtRequest,
    getCurrentRootDir: getCurrentRootDir ?? (() => rootDir),
    path: absolutePath,
    allowUnlockRetry: true,
    promptWorkspacePassword,
    t,
  }
  const persistHandlers = {
    path: absolutePath,
    onConflict,
    onWriteError,
    t,
  }

  if (isOpen) {
    await commitOpenDocumentMemorySurfaces({
      absolutePath,
      activePath,
      editorSurface: projected.editorSurface,
      sourceIdentity: projected.sourceIdentity,
      source: 'knowledge-graph-link-remove',
      contentRef,
    })
    const saved = await persistOpenDocumentWithEncryptionRetry(
      {
        ...saveBaseOptions,
        content: projected.sourceIdentity,
        source: 'knowledge-graph-link-remove',
      },
      { ...persistHandlers, local: projected.sourceIdentity },
    )
    if (!saved) return false
    notifyKnowledgeDocumentSave(absolutePath, projected.sourceIdentity)
    return true
  }

  const saved = await persistClosedDocumentWithConflictGuardAndEncryptionRetry(
    {
      ...saveBaseOptions,
      content: full,
      source: 'knowledge-graph-link-remove',
    },
    { ...persistHandlers, local: full },
  )
  if (!saved) return false
  syncDocumentFrontmatterFromMarkdown(absolutePath, full)
  notifyKnowledgeDocumentSave(absolutePath, full)
  return true
}
