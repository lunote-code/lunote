import { dispatchDocumentCommand } from '../documentRuntime/documentKernel'
import { statNoteFile } from '../platform/tauri/documentService'
import { isWorkspaceMigratingError } from '../platform/tauri/workspaceEncryptionService'
import { ensureWorkspaceUnlocked, type WorkspacePasswordPrompt } from './workspaceEncryptionRuntime'
import {
  formatWorkspaceEncryptionErrorMessage,
  shouldAbortStaleWorkspaceSave,
  shouldRetrySaveAfterWorkspaceUnlock,
} from './workspaceEncryptionErrors'

export class StaleWorkspaceSaveAbortedError extends Error {
  constructor() {
    super('STALE_WORKSPACE_SAVE_ABORTED')
    this.name = 'StaleWorkspaceSaveAbortedError'
  }
}

export class WorkspaceSaveUnlockCancelledError extends Error {
  constructor() {
    super('WORKSPACE_SAVE_UNLOCK_CANCELLED')
    this.name = 'WorkspaceSaveUnlockCancelledError'
  }
}

export type EncryptedDocumentSaveOptions = {
  rootAtRequest: string
  getCurrentRootDir: () => string
  path: string
  content: string
  source: string
  allowUnlockRetry: boolean
  forceOverwrite?: boolean
  expectedModifiedSecs?: number
  promptWorkspacePassword?: WorkspacePasswordPrompt
  t: (key: string, params?: Record<string, string | number>) => string
}

export type EncryptedDocumentSaveDeps = {
  dispatchSave: (options: {
    root: string
    path: string
    content: string
    source: string
    forceOverwrite?: boolean
    expectedModifiedSecs?: number
  }) => Promise<void>
  ensureUnlocked: (
    root: string,
    promptPassword: WorkspacePasswordPrompt,
    t: (key: string, params?: Record<string, string | number>) => string,
  ) => Promise<boolean>
  shouldAbortStale: (rootAtRequest: string, currentRootDir: string) => boolean
  shouldRetryUnlock: (error: unknown, allowUnlockRetry: boolean, hasPrompt: boolean) => boolean
}

const defaultEncryptedDocumentSaveDeps: EncryptedDocumentSaveDeps = {
  dispatchSave: async ({ root, path, content, source, forceOverwrite, expectedModifiedSecs }) => {
    await dispatchDocumentCommand({
      type: 'SAVE_DOCUMENT',
      root,
      path,
      content,
      source,
      forceOverwrite,
      expectedModifiedSecs,
    })
  },
  ensureUnlocked: ensureWorkspaceUnlocked,
  shouldAbortStale: shouldAbortStaleWorkspaceSave,
  shouldRetryUnlock: shouldRetrySaveAfterWorkspaceUnlock,
}

export function resolveEncryptedSaveFailureMessage(
  error: unknown,
  t: (key: string, params?: Record<string, string | number>) => string,
): string | null {
  if (error instanceof StaleWorkspaceSaveAbortedError) {
    return null
  }
  if (error instanceof WorkspaceSaveUnlockCancelledError) {
    return t('workspace.encryption.unlock.cancelled')
  }
  const encryptionMessage = formatWorkspaceEncryptionErrorMessage(error, t)
  if (encryptionMessage || isWorkspaceMigratingError(error)) {
    return encryptionMessage ?? t('workspace.encryption.error.migrating')
  }
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

export type EncryptedDocumentPersistHandlers = {
  path: string
  local: string
  onConflict?: (path: string, local: string) => Promise<void> | void
  onWriteError?: (message: string) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

/** Handles conflict, stale, and encryption failures for background document writes. */
export async function handleEncryptedDocumentPersistFailure(
  error: unknown,
  handlers: EncryptedDocumentPersistHandlers,
): Promise<false> {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('FILE_CONFLICT')) {
    await handlers.onConflict?.(handlers.path, handlers.local)
    return false
  }
  if (error instanceof StaleWorkspaceSaveAbortedError) {
    return false
  }
  const failureMessage = resolveEncryptedSaveFailureMessage(error, handlers.t)
  if (failureMessage) {
    handlers.onWriteError?.(failureMessage)
  }
  return false
}

export async function persistOpenDocumentWithEncryptionRetryWithDeps(
  options: EncryptedDocumentSaveOptions,
  handlers: EncryptedDocumentPersistHandlers,
  deps: EncryptedDocumentSaveDeps = defaultEncryptedDocumentSaveDeps,
): Promise<boolean> {
  try {
    await dispatchSaveDocumentWithEncryptionRetryWithDeps(options, deps)
    return true
  } catch (error) {
    return handleEncryptedDocumentPersistFailure(error, handlers)
  }
}

export async function persistOpenDocumentWithEncryptionRetry(
  options: EncryptedDocumentSaveOptions,
  handlers: EncryptedDocumentPersistHandlers,
): Promise<boolean> {
  return persistOpenDocumentWithEncryptionRetryWithDeps(options, handlers)
}

export async function persistClosedDocumentWithConflictGuardAndEncryptionRetry(
  options: EncryptedDocumentSaveOptions,
  handlers: EncryptedDocumentPersistHandlers,
): Promise<boolean> {
  let expectedModifiedSecs: number | undefined
  try {
    expectedModifiedSecs = (await statNoteFile(options.rootAtRequest, options.path)).modifiedSecs
  } catch {
    expectedModifiedSecs = undefined
  }
  return persistOpenDocumentWithEncryptionRetryWithDeps(
    { ...options, expectedModifiedSecs },
    handlers,
  )
}

export type EncryptedDocumentReadOptions = {
  rootAtRequest: string
  getCurrentRootDir: () => string
  path: string
  allowUnlockRetry: boolean
  promptWorkspacePassword?: WorkspacePasswordPrompt
  t: (key: string, params?: Record<string, string | number>) => string
  readDocument: (root: string, path: string) => Promise<string>
}

export type EncryptedDocumentReadDeps = Pick<
  EncryptedDocumentSaveDeps,
  'ensureUnlocked' | 'shouldAbortStale' | 'shouldRetryUnlock'
>

const defaultEncryptedDocumentReadDeps: EncryptedDocumentReadDeps = {
  ensureUnlocked: ensureWorkspaceUnlocked,
  shouldAbortStale: shouldAbortStaleWorkspaceSave,
  shouldRetryUnlock: shouldRetrySaveAfterWorkspaceUnlock,
}

export async function readClosedDocumentWithEncryptionRetryWithDeps(
  options: EncryptedDocumentReadOptions,
  deps: EncryptedDocumentReadDeps = defaultEncryptedDocumentReadDeps,
): Promise<string | null> {
  const {
    rootAtRequest,
    getCurrentRootDir,
    path,
    allowUnlockRetry,
    promptWorkspacePassword,
    t,
    readDocument,
  } = options
  try {
    return await readDocument(rootAtRequest, path)
  } catch (error) {
    if (deps.shouldAbortStale(rootAtRequest, getCurrentRootDir())) {
      return null
    }
    if (
      deps.shouldRetryUnlock(error, allowUnlockRetry, Boolean(promptWorkspacePassword)) &&
      promptWorkspacePassword
    ) {
      const unlocked = await deps.ensureUnlocked(rootAtRequest, promptWorkspacePassword, t)
      if (!unlocked) return null
      try {
        return await readDocument(rootAtRequest, path)
      } catch {
        return null
      }
    }
    return null
  }
}

export async function readClosedDocumentWithEncryptionRetry(
  options: EncryptedDocumentReadOptions,
): Promise<string | null> {
  return readClosedDocumentWithEncryptionRetryWithDeps(options)
}

export async function dispatchSaveDocumentWithEncryptionRetryWithDeps(
  options: EncryptedDocumentSaveOptions,
  deps: EncryptedDocumentSaveDeps = defaultEncryptedDocumentSaveDeps,
): Promise<void> {
  const {
    rootAtRequest,
    getCurrentRootDir,
    path,
    content,
    source,
    allowUnlockRetry,
    forceOverwrite,
    expectedModifiedSecs,
    promptWorkspacePassword,
    t,
  } = options

  try {
    await deps.dispatchSave({
      root: rootAtRequest,
      path,
      content,
      source,
      forceOverwrite,
      expectedModifiedSecs,
    })
  } catch (error) {
    if (deps.shouldAbortStale(rootAtRequest, getCurrentRootDir())) {
      throw new StaleWorkspaceSaveAbortedError()
    }
    if (
      deps.shouldRetryUnlock(error, allowUnlockRetry, Boolean(promptWorkspacePassword)) &&
      promptWorkspacePassword
    ) {
      const unlocked = await deps.ensureUnlocked(rootAtRequest, promptWorkspacePassword, t)
      if (unlocked) {
        return dispatchSaveDocumentWithEncryptionRetryWithDeps(
          {
            ...options,
            allowUnlockRetry: false,
          },
          deps,
        )
      }
      throw new WorkspaceSaveUnlockCancelledError()
    }
    throw error
  }
}

export async function dispatchSaveDocumentWithEncryptionRetry(
  options: EncryptedDocumentSaveOptions,
): Promise<void> {
  return dispatchSaveDocumentWithEncryptionRetryWithDeps(options)
}
