import {
  attachDocumentFrontmatter,
  getDocumentFrontmatterFields,
  getDocumentFrontmatterHadLeadingBlock,
  setDocumentFrontmatterFields,
  syncDocumentFrontmatterFromMarkdown,
} from '../../editor/documentFrontmatterStore'
import { docKeyToAbsolutePath } from '../../editor/knowledgeOS'
import { parseFrontmatter } from '../../editor/knowledgeRuntime/wikiLinkParser'
import { notifyKnowledgeDocumentSave } from '../../editor/knowledgeOS/ui/knowledgeAppIntegration'
import { applyActiveDocumentContentImmediately, dispatchDocumentCommand } from '../../documentRuntime/documentKernel'
import {
  getDocumentAuthorityProjection,
  resolveLatestDocumentBody,
} from '../../documentRuntime/documentAuthority'
import { projectDocumentMemorySurfaces } from '../../lib/editorContentSync'
import { pathsEqual } from '../../lib/workspacePathUtils'
import { setSourceModeIdentity } from '../../editor/sourceModeIdentity'
import { seedDocumentFrontmatterCacheIfMissing } from './seedDocumentFrontmatterCache'
import {
  persistClosedDocumentWithConflictGuardAndEncryptionRetry,
  persistOpenDocumentWithEncryptionRetry,
} from '../../workspace/encryptedDocumentSave'
import type { WorkspacePasswordPrompt } from '../../workspace/workspaceEncryptionRuntime'

export async function applyDocumentFrontmatterUpdate(args: {
  rootDir: string
  getCurrentRootDir?: () => string
  promptWorkspacePassword?: WorkspacePasswordPrompt
  docKey: string
  activePath: string | null
  contentRef: { current: string }
  readDocument?: (root: string, path: string) => Promise<string>
  updater: (current: Record<string, unknown>) => Record<string, unknown>
  onConflict?: (path: string, local: string) => Promise<void> | void
  onWriteError?: (message: string) => void
  t?: (key: string, params?: Record<string, string | number>) => string
}): Promise<boolean> {
  const {
    rootDir,
    getCurrentRootDir,
    promptWorkspacePassword,
    docKey,
    activePath,
    contentRef,
    readDocument,
    updater,
    onConflict,
    onWriteError,
    t = (key) => key,
  } = args
  const rootAtRequest = rootDir.replace(/[/\\]+$/u, '')
  const absolutePath = docKeyToAbsolutePath(docKey, rootDir)
  if (!absolutePath) return false
  const authority = getDocumentAuthorityProjection()
  const isActive = pathsEqual(activePath ?? '', absolutePath)
  const isOpen =
    isActive ||
    authority.runtime.openedTabs.some((tabPath) => pathsEqual(tabPath, absolutePath))

  if (!(await seedDocumentFrontmatterCacheIfMissing({
    absolutePath,
    isOpen,
    activePath,
    contentRef,
    readDocument,
    rootAtRequest,
  }))) {
    return false
  }

  const baseFields = { ...(getDocumentFrontmatterFields(absolutePath) ?? {}) }
  const nextFields = updater(baseFields)
  setDocumentFrontmatterFields(absolutePath, nextFields, {
    hadLeadingBlock:
      getDocumentFrontmatterHadLeadingBlock(absolutePath) || Object.keys(nextFields).length > 0,
  })

  let currentFull: string | undefined
  if (isOpen) {
    currentFull = resolveLatestDocumentBody(absolutePath, {
      projection: authority,
      contentFallback: contentRef.current,
    })
  } else if (readDocument) {
    try {
      currentFull = await readDocument(rootAtRequest, absolutePath)
    } catch {
      return false
    }
  }
  if (!currentFull) return false

  const { body } = parseFrontmatter(currentFull)

  const full = attachDocumentFrontmatter(absolutePath, body)
  syncDocumentFrontmatterFromMarkdown(absolutePath, full)
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
    await dispatchDocumentCommand({
      type: 'UPDATE_OPEN_DOCUMENT_CONTENT',
      path: absolutePath,
      content: projected.editorSurface,
      source: 'document-frontmatter-update',
    })
    setSourceModeIdentity(absolutePath, projected.sourceIdentity)
    if (isActive) {
      contentRef.current = projected.editorSurface
      applyActiveDocumentContentImmediately(
        absolutePath,
        projected.editorSurface,
        'document-frontmatter-update',
      )
    }
    const saved = await persistOpenDocumentWithEncryptionRetry(
      {
        ...saveBaseOptions,
        content: projected.sourceIdentity,
        source: 'document-frontmatter-update',
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
      source: 'document-frontmatter-update',
    },
    { ...persistHandlers, local: full },
  )
  if (!saved) return false

  notifyKnowledgeDocumentSave(absolutePath, full)
  return true
}
