import { useCallback, type MutableRefObject, type RefObject } from 'react'
import { save } from '@tauri-apps/plugin-dialog'
import { isTauri } from '@tauri-apps/api/core'

import type { TranslateFn } from '../../i18n'
import { fileDialogFilter } from '../../lib/fileDialogFilters'
import {
  defaultExportBasename,
  downloadHtmlBlob,
  markdownToDocxBase64,
  markdownToPlainHtmlFragment,
  resolveExportDocumentClasses,
  markdownToStyledHtmlFragment,
  openPrintableHtml,
  PrintContentTooLargeError,
  PrintPermissionRequiredError,
  PrintPopupBlockedError,
  PrintWindowTimedOutError,
  wrapStandaloneHtml,
  type AppExportFormat,
} from '../../markdownExport'
import { buildPdfExportHtml } from '../../export/pdfExportHtml'
import { downloadBinaryBlob, markdownToPdfBase64, markdownToPngBase64 } from '../../export/renderedDocumentExport'
import { humanizeExportError } from '../../export/exportUserFacingError'
import {
  captureAiRailScrollSnapshotForRestore,
  preserveAiRailScrollDuring,
  scheduleAiRailScrollRestoreAfterSideEffects,
} from '../../editor/ai/ui/aiRailScrollPreserve'
import { rewriteExportHtmlMediaSources } from '../export/htmlMedia'
import { exportBinaryPayload, exportNotePayload } from '../../lib/tauriScopedInvoke'
import {
  commitLatestDocumentBodyToMemory,
  diskMarkdownForDocumentSave,
  projectSavedMarkdownToEditorSurfaces,
  resolveActiveAwareSaveBodyFallback,
  resolveMarkdownForSave,
  syncActiveDocumentBodyImmediately,
  tryResolveBoundEditorMarkdown,
} from '../../lib/editorContentSync'
import { enqueueSave } from '../../lib/saveQueue'
import { isPathDirty } from '../../lib/documentDirty'
import { clearExternalDiskDriftInState } from '../../lib/externalDiskDriftState'
import { isPathUnderWorkspace } from '../../lib/workspacePathUtils'
import { dispatchDocumentCommand } from '../../documentRuntime/documentKernel'
import { resolveLatestDocumentBody } from '../../documentRuntime/documentAuthority'
import { openSaveConflictDialog, type SaveConflictState } from '../document/saveConflictState'
import { pathsEqual } from '../../lib/workspacePathUtils'
import { isBufferTabId } from '../workspace/constants'
import type { TiptapMarkdownEditorHandle } from '../../editor/TiptapMarkdownEditor'
import { runAfterReactCommit } from '../../editor/reactCommitScheduler'
import { schedulePrimeEditorDiagramPreviews } from '../../editor/runtimeEngine/primeEditorDiagramPreviews'
import type { AssetStorageConfig } from '../../assets/assetStoragePolicy'
import { refreshWorkspaceIndex } from '../workspace/workspaceIndexCoordinator'
import { exportBinaryNote, exportNote } from '../../platform/tauri/documentService'
import type { AppStatusTone } from './useAppStatus'
import type { WorkspacePasswordPrompt } from '../../workspace/workspaceEncryptionRuntime'
import {
  StaleWorkspaceSaveAbortedError,
  WorkspaceSaveUnlockCancelledError,
  dispatchSaveDocumentWithEncryptionRetry,
} from '../../workspace/encryptedDocumentSave'
import { formatWorkspaceEncryptionErrorMessage } from '../../workspace/workspaceEncryptionErrors'
import { isWorkspaceMigratingError } from '../../platform/tauri/workspaceEncryptionService'

async function handleWorkspaceDocumentSaveError(
  error: unknown,
  options: {
    manual: boolean
    rootAtRequest: string
    path: string
    local: string
    setSaveConflict: React.Dispatch<React.SetStateAction<SaveConflictState | null>>
    setStatus: (msg: string, toneOverride?: AppStatusTone) => void
    t: TranslateFn
  },
): Promise<void> {
  if (error instanceof StaleWorkspaceSaveAbortedError) {
    return
  }
  if (error instanceof WorkspaceSaveUnlockCancelledError) {
    if (options.manual) {
      options.setStatus(options.t('workspace.encryption.unlock.cancelled'), 'warning')
    }
    return
  }
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('FILE_CONFLICT')) {
    await openSaveConflictDialog({
      rootDir: options.rootAtRequest,
      path: options.path,
      local: options.local,
      sourceMode: 'manual',
      setSaveConflict: options.setSaveConflict,
      setStatus: options.setStatus,
      t: options.t,
    })
    return
  }
  const encryptionMessage = formatWorkspaceEncryptionErrorMessage(error, options.t)
  if (encryptionMessage || isWorkspaceMigratingError(error)) {
    if (options.manual) {
      options.setStatus(encryptionMessage ?? options.t('workspace.encryption.error.migrating'), 'warning')
    }
    return
  }
  if (options.manual) {
    options.setStatus(options.t('app.status.saveFailed', { message }), 'error')
  }
}

export type DocumentSaveDeps = {
  t: TranslateFn
  activePath: string
  content: string
  rootDir: string
  rootDirRef: MutableRefObject<string>
  promptWorkspacePassword?: WorkspacePasswordPrompt
  mainPaneMode: 'visual' | 'source'
  isDark: boolean
  bufferTabLabels: Record<string, string>
  setBufferTabLabels: React.Dispatch<React.SetStateAction<Record<string, string>>>
  assetStorageConfig: AssetStorageConfig
  activePathRef: RefObject<string>
  contentRef: RefObject<string>
  visualEditorRef: RefObject<TiptapMarkdownEditorHandle | null>
  suppressMarkdownSerdeRef: MutableRefObject<boolean>
  suppressWorkspaceRefreshUntilRef: MutableRefObject<number>
  isVisualEditorBoundToActivePath: () => boolean
  setSavedAt: React.Dispatch<React.SetStateAction<string>>
  setSaveConflict: React.Dispatch<React.SetStateAction<SaveConflictState | null>>
  setStatus: (msg: string, toneOverride?: AppStatusTone) => void
  refreshFileTree: () => Promise<void>
  onWorkspaceDocumentSaved?: (path: string, savedAtMs?: number) => void
  updateRecent: (path: string) => void
  resetModeSwitchEditorBootstrap: () => void
  flushPendingKernelContentDebounce: () => Promise<void>
  setExternalDiskChangedPaths: React.Dispatch<React.SetStateAction<Set<string>>>
}

export function useDocumentSave(deps: DocumentSaveDeps) {
  const {
    t,
    activePath,
    rootDir,
    rootDirRef,
    promptWorkspacePassword,
    mainPaneMode,
    isDark,
    bufferTabLabels,
    setBufferTabLabels,
    activePathRef,
    contentRef,
    visualEditorRef,
    suppressMarkdownSerdeRef,
    suppressWorkspaceRefreshUntilRef,
    setSavedAt,
    setSaveConflict,
    setStatus,
    refreshFileTree,
    onWorkspaceDocumentSaved,
    updateRecent,
    resetModeSwitchEditorBootstrap,
    flushPendingKernelContentDebounce,
    setExternalDiskChangedPaths,
  } = deps

  const runAppExportFormat = useCallback(
    async (format: AppExportFormat) => {
          if (!activePath) {
            setStatus(t('app.status.exportNoFile'), 'info')
            return
          }
          suppressMarkdownSerdeRef.current = false
          try {
            const exportMarkdown = await resolveMarkdownForSave(
              mainPaneMode,
              visualEditorRef.current,
              contentRef.current,
              activePath,
            )
            const exportDocumentClasses = resolveExportDocumentClasses(exportMarkdown)
            const unnamed = t('app.tab.unnamed')
            const stem = isBufferTabId(activePath)
              ? (bufferTabLabels[activePath] || unnamed).replace(/\.(md|markdown)$/i, '') || unnamed
              : defaultExportBasename(activePath)
            const sourcePath = isBufferTabId(activePath) ? '' : activePath
            if (!isTauri()) {
              if (format === 'html') {
                const body = rewriteExportHtmlMediaSources(
                  await markdownToStyledHtmlFragment(exportMarkdown),
                  sourcePath,
                  rootDir || null,
                )
                const html = wrapStandaloneHtml(body, {
                  title: stem,
                  styled: true,
                  dark: isDark,
                  documentClasses: exportDocumentClasses,
                })
                downloadHtmlBlob(`${stem}.html`, html)
                setStatus(t('app.status.downloadHtmlStyled'), 'success')
                return
              }
              if (format === 'htmlPlain') {
                const body = rewriteExportHtmlMediaSources(
                  await markdownToPlainHtmlFragment(exportMarkdown),
                  sourcePath,
                  rootDir || null,
                )
                const html = wrapStandaloneHtml(body, {
                  title: stem,
                  styled: false,
                  dark: isDark,
                  documentClasses: exportDocumentClasses,
                })
                downloadHtmlBlob(`${stem}-plain.html`, html)
                setStatus(t('app.status.downloadHtmlPlain'), 'success')
                return
              }
              if (format === 'pdf') {
                const b64 = await markdownToPdfBase64(exportMarkdown, {
                  title: stem,
                  dark: isDark,
                  sourcePath,
                  rootDir: rootDir || undefined,
                })
                const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
                downloadBinaryBlob(`${stem}.pdf`, new Blob([bin], { type: 'application/pdf' }))
                setStatus(t('app.status.downloadPdf'), 'success')
                return
              }
              if (format === 'image') {
                const b64 = await markdownToPngBase64(exportMarkdown, {
                  title: stem,
                  dark: isDark,
                  sourcePath,
                  rootDir: rootDir || undefined,
                })
                const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
                downloadBinaryBlob(`${stem}.png`, new Blob([bin], { type: 'image/png' }))
                setStatus(t('app.status.downloadImage'), 'success')
                return
              }
              if (format === 'word') {
                const b64 = await markdownToDocxBase64(exportMarkdown, {
                  sourcePath,
                  rootDir: rootDir || undefined,
                  dark: isDark,
                })
                const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
                const blob = new Blob([bin], {
                  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${stem}.docx`
                a.rel = 'noopener'
                document.body.appendChild(a)
                a.click()
                a.remove()
                URL.revokeObjectURL(url)
                setStatus(t('app.status.downloadWord'), 'success')
                return
              }
            }
            if (format === 'pdf') {
              const b64 = await markdownToPdfBase64(exportMarkdown, {
                title: stem,
                dark: isDark,
                sourcePath,
                rootDir: rootDir || undefined,
              })
              const out = await save({
                title: t('app.dialog.exportPdf'),
                defaultPath: `${stem}.pdf`,
                filters: [fileDialogFilter(t, 'pdf', ['pdf'])],
              })
              if (!out) return
              await exportBinaryNote(exportBinaryPayload(out, b64, rootDir || ''))
              setStatus(t('app.status.exportedPdf'), 'success')
              return
            }
            if (format === 'html') {
              const body = rewriteExportHtmlMediaSources(
                await markdownToStyledHtmlFragment(exportMarkdown),
                sourcePath,
                rootDir || null,
              )
              const html = wrapStandaloneHtml(body, {
                title: stem,
                styled: true,
                dark: isDark,
                documentClasses: exportDocumentClasses,
              })
              const out = await save({
                title: t('app.dialog.exportHtml'),
                defaultPath: `${stem}.html`,
                filters: [fileDialogFilter(t, 'html', ['html', 'htm'])],
              })
              if (!out) return
              await exportNote(exportNotePayload(out, html, rootDir || ''))
              setStatus(t('app.status.exportedHtml'), 'success')
              return
            }
            if (format === 'htmlPlain') {
              const body = rewriteExportHtmlMediaSources(
                await markdownToPlainHtmlFragment(exportMarkdown),
                sourcePath,
                rootDir || null,
              )
              const html = wrapStandaloneHtml(body, {
                title: stem,
                styled: false,
                dark: isDark,
                documentClasses: exportDocumentClasses,
              })
              const out = await save({
                title: t('app.dialog.exportHtmlPlain'),
                defaultPath: `${stem}.html`,
                filters: [fileDialogFilter(t, 'html', ['html', 'htm'])],
              })
              if (!out) return
              await exportNote(exportNotePayload(out, html, rootDir || ''))
              setStatus(t('app.status.exportedHtmlPlain'), 'success')
              return
            }
            if (format === 'image') {
              const b64 = await markdownToPngBase64(exportMarkdown, {
                title: stem,
                dark: isDark,
                sourcePath,
                rootDir: rootDir || undefined,
              })
              const out = await save({
                title: t('app.dialog.exportImage'),
                defaultPath: `${stem}.png`,
                filters: [fileDialogFilter(t, 'png', ['png'])],
              })
              if (!out) return
              await exportBinaryNote(exportBinaryPayload(out, b64, rootDir || ''))
              setStatus(t('app.status.exportedImage'), 'success')
              return
            }
            if (format === 'word') {
              const b64 = await markdownToDocxBase64(exportMarkdown, {
                sourcePath,
                rootDir: rootDir || undefined,
                dark: isDark,
              })
              const out = await save({
                title: t('app.dialog.exportWord'),
                defaultPath: `${stem}.docx`,
                filters: [fileDialogFilter(t, 'word', ['docx'])],
              })
              if (!out) return
              await exportBinaryNote(exportBinaryPayload(out, b64, rootDir || ''))
              setStatus(t('app.status.exportedWord'), 'success')
            }
          } catch (e) {
            setStatus(t('app.status.exportFailed', { message: humanizeExportError(e, t) }), 'error')
          }
    },
    [activePath, bufferTabLabels, contentRef, isDark, mainPaneMode, rootDir, setStatus, suppressMarkdownSerdeRef, t, visualEditorRef],
  )

  const resolveDocumentBodyForPath = useCallback(
    (path: string, contentFallback?: string) => {
      return resolveLatestDocumentBody(path, { contentFallback })
    },
    [],
  )

  const saveCurrent = useCallback(
        async (manual = true) => {
          /** Fixed the path when initiating the save to avoid writing to the wrong file due to the tab being cut before the queue is executed.*/
          const pathAtRequest = activePathRef.current ?? ''
          const pathToSave = pathAtRequest || 'scratch'
          const rootAtRequest = rootDir
          const contentSnapshotAtRequest = contentRef.current
          const tabBodySnapshotAtRequest = resolveDocumentBodyForPath(pathToSave, contentSnapshotAtRequest)
          return enqueueSave(async () => {
            captureAiRailScrollSnapshotForRestore()
            await flushPendingKernelContentDebounce()
            suppressMarkdownSerdeRef.current = false
            const editorBoundToSavePath =
              mainPaneMode !== 'visual' ||
              !visualEditorRef.current ||
              pathsEqual(visualEditorRef.current.getBoundDocumentKey(), pathToSave)
            const canReadBodyFromEditor =
              pathsEqual(activePathRef.current, pathToSave) && editorBoundToSavePath

            let body: string | undefined
            if (canReadBodyFromEditor) {
              let resolved: string | null
              try {
                resolved = await tryResolveBoundEditorMarkdown(
                  mainPaneMode,
                  visualEditorRef.current,
                  contentSnapshotAtRequest,
                  pathToSave,
                  () => activePathRef.current,
                )
              } catch (error) {
                setStatus(t('app.status.saveFailed', { message: error instanceof Error ? error.message : String(error) }), 'error')
                return
              }
              if (resolved != null) {
                body = resolved
              } else {
                body = resolveActiveAwareSaveBodyFallback({
                  pathToSave,
                  tabBodySnapshot: tabBodySnapshotAtRequest,
                  contentSnapshot: contentSnapshotAtRequest,
                  activePath: activePathRef.current,
                  activeContent: contentRef.current,
                  resolveDocumentBody: resolveDocumentBodyForPath,
                })
              }
            } else {
              body = resolveActiveAwareSaveBodyFallback({
                pathToSave,
                tabBodySnapshot: tabBodySnapshotAtRequest,
                contentSnapshot: contentSnapshotAtRequest,
                activePath: activePathRef.current,
                activeContent: contentRef.current,
                resolveDocumentBody: resolveDocumentBodyForPath,
              })
              if (body == null && !editorBoundToSavePath && pathsEqual(activePathRef.current, pathToSave)) {
                setStatus(t('app.status.saveFailed', { message: t('app.status.editorBinding') }), 'error')
                return
              }
            }
            if (body == null) {
              if (manual) {
                setStatus(t('app.status.saveFailed', { message: t('app.status.saveNothingHint') }), 'error')
              }
              return
            }
            const runtimeBodyAtSave = resolveDocumentBodyForPath(pathToSave, contentSnapshotAtRequest)
            const diskMarkdown = diskMarkdownForDocumentSave(pathToSave, body)
            const projected = projectSavedMarkdownToEditorSurfaces(mainPaneMode, diskMarkdown)
            if (pathsEqual(activePathRef.current, pathToSave)) {
              preserveAiRailScrollDuring(() => {
                commitLatestDocumentBodyToMemory({
                  path: pathToSave,
                  body: projected.editorSurface,
                  sourceIdentity: projected.sourceIdentity,
                  contentRef,
                })
                if (projected.editorSurface !== runtimeBodyAtSave) {
                  suppressMarkdownSerdeRef.current = true
                  try {
                    syncActiveDocumentBodyImmediately({
                      path: pathToSave,
                      body: projected.editorSurface,
                      contentRef,
                      source: 'save-flush',
                    })
                  } finally {
                    suppressMarkdownSerdeRef.current = false
                  }
                }
              })
            } else {
              commitLatestDocumentBodyToMemory({
                path: pathToSave,
                body: projected.editorSurface,
                sourceIdentity: projected.sourceIdentity,
                contentRef,
              })
            }
            if (canReadBodyFromEditor && mainPaneMode === 'visual') {
              runAfterReactCommit(() => {
                preserveAiRailScrollDuring(() => {
                  schedulePrimeEditorDiagramPreviews(() => {
                    const pm = visualEditorRef.current?.getEditor()
                    return pm?.view?.dom ?? null
                  })
                })
                scheduleAiRailScrollRestoreAfterSideEffects()
              })
            }
            if (pathAtRequest && isBufferTabId(pathAtRequest) && rootAtRequest) {
              if (!manual) return
              setStatus(t('app.status.bufferSaveAsHint'), 'info')
              const base = rootAtRequest.replace(/[/\\]+$/u, '')
              const picked = await save({
                title: t('app.dialog.saveAs'),
                defaultPath: `${base}/${t('app.defaults.newNoteStem')}.md`,
                filters: [fileDialogFilter(t, 'markdown', ['md', 'markdown'])],
              })
              if (!picked) return
              if (!isPathUnderWorkspace(rootAtRequest, picked)) {
                setStatus(t('app.status.saveOutsideWorkspace'), 'warning')
                return
              }
              try {
                await dispatchSaveDocumentWithEncryptionRetry({
                  rootAtRequest,
                  getCurrentRootDir: () => rootDirRef.current,
                  path: picked,
                  content: diskMarkdown,
                  source: 'save-current-buffer',
                  allowUnlockRetry: manual,
                  promptWorkspacePassword,
                  t,
                })
              } catch (error) {
                await handleWorkspaceDocumentSaveError(error, {
                  manual,
                  rootAtRequest,
                  path: picked,
                  local: diskMarkdown,
                  setSaveConflict,
                  setStatus,
                  t,
                })
                return
              }
              resetModeSwitchEditorBootstrap()
              await dispatchDocumentCommand({
                type: 'REPLACE_ACTIVE_DOCUMENT',
                path: picked,
                content: diskMarkdown,
                source: 'save-as',
              })
              updateRecent(picked)
              await refreshFileTree()
              await refreshWorkspaceIndex(rootAtRequest)
              setSavedAt(new Date().toLocaleTimeString())
              setStatus(t('app.status.saved'), 'success')
              return
            }
            if (!rootAtRequest) {
              if (!manual) return
              const canExport =
                (Boolean(activePath) && isBufferTabId(activePath)) || isPathDirty(activePath)
              if (!canExport) {
                setStatus(t('app.status.saveNothingHint'), 'info')
                return
              }
              const picked = await save({
                title: t('app.dialog.saveMarkdown'),
                defaultPath: t('app.defaults.untitledMd'),
                filters: [fileDialogFilter(t, 'markdown', ['md', 'markdown'])],
              })
              if (!picked) return
              try {
                await exportNote(exportNotePayload(picked, body, rootDir || ''))
              } catch (e) {
                setStatus(t('app.status.saveFailed', { message: e instanceof Error ? e.message : String(e) }), 'error')
                return
              }
              const name = picked.replace(/\\/g, '/').split('/').pop() ?? t('app.defaults.untitledMd')
              if (activePath && isBufferTabId(activePath)) {
                setBufferTabLabels((prev) => ({ ...prev, [activePath]: name }))
              }
              setSavedAt(new Date().toLocaleTimeString())
              setStatus(t('app.status.savedTo', { path: picked }), 'success')
              return
            }
            if (!pathAtRequest) {
              if (!manual) return
              const base = rootAtRequest.replace(/[/\\]+$/u, '')
              const picked = await save({
                title: t('app.dialog.saveAs'),
                defaultPath: `${base}/${t('app.defaults.newNoteStem')}.md`,
                filters: [fileDialogFilter(t, 'markdown', ['md', 'markdown'])],
              })
              if (!picked) return
              if (!isPathUnderWorkspace(rootAtRequest, picked)) {
                setStatus(t('app.status.saveOutsideWorkspace'), 'warning')
                return
              }
              try {
                await dispatchSaveDocumentWithEncryptionRetry({
                  rootAtRequest,
                  getCurrentRootDir: () => rootDirRef.current,
                  path: picked,
                  content: diskMarkdown,
                  source: 'saveCurrent',
                  allowUnlockRetry: manual,
                  promptWorkspacePassword,
                  t,
                })
              } catch (error) {
                await handleWorkspaceDocumentSaveError(error, {
                  manual,
                  rootAtRequest,
                  path: picked,
                  local: diskMarkdown,
                  setSaveConflict,
                  setStatus,
                  t,
                })
                return
              }
              resetModeSwitchEditorBootstrap()
              await dispatchDocumentCommand({
                type: 'REPLACE_ACTIVE_DOCUMENT',
                path: picked,
                content: diskMarkdown,
                source: 'save-as',
              })
              updateRecent(picked)
              await refreshFileTree()
              await refreshWorkspaceIndex(rootAtRequest)
              setSavedAt(new Date().toLocaleTimeString())
              setStatus(t('app.status.saved'), 'success')
              return
            }
            if (!isPathDirty(pathAtRequest || pathToSave) && !manual) return
            try {
              await dispatchSaveDocumentWithEncryptionRetry({
                rootAtRequest,
                getCurrentRootDir: () => rootDirRef.current,
                path: pathAtRequest || pathToSave,
                content: diskMarkdown,
                source: 'saveCurrent',
                allowUnlockRetry: manual,
                promptWorkspacePassword,
                t,
              })
            } catch (error) {
              await handleWorkspaceDocumentSaveError(error, {
                manual,
                rootAtRequest,
                path: pathAtRequest || pathToSave,
                local: diskMarkdown,
                setSaveConflict,
                setStatus,
                t,
              })
              return
            }
            suppressWorkspaceRefreshUntilRef.current = Date.now() + 2500
            await flushPendingKernelContentDebounce()
            const savedPath = pathAtRequest || pathToSave
            const savedAtMs = Date.now()
            onWorkspaceDocumentSaved?.(savedPath, savedAtMs)
            setExternalDiskChangedPaths((prev) => clearExternalDiskDriftInState(prev, savedPath))
            scheduleAiRailScrollRestoreAfterSideEffects()
            preserveAiRailScrollDuring(() => {
              setSavedAt(new Date().toLocaleTimeString())
              if (manual) {
                setStatus(t('app.status.saved'), 'success')
              }
            })
            scheduleAiRailScrollRestoreAfterSideEffects()
          })
    },
    [activePath, activePathRef, flushPendingKernelContentDebounce, contentRef, promptWorkspacePassword, rootDir, rootDirRef, mainPaneMode, refreshFileTree, onWorkspaceDocumentSaved, updateRecent, resetModeSwitchEditorBootstrap, resolveDocumentBodyForPath, setBufferTabLabels, setExternalDiskChangedPaths, setSaveConflict, setSavedAt, setStatus, suppressMarkdownSerdeRef, suppressWorkspaceRefreshUntilRef, t, visualEditorRef],
  )

  const saveAsCurrent = useCallback(async () => {
      const pathToSave = activePathRef.current || 'scratch'
      const rootAtRequest = rootDir
      const contentSnapshotAtRequest = contentRef.current
      const tabBodySnapshotAtRequest = resolveDocumentBodyForPath(pathToSave, contentSnapshotAtRequest)
      return enqueueSave(async () => {
        const editorBoundToSavePath =
          mainPaneMode !== 'visual' ||
          !visualEditorRef.current ||
          pathsEqual(visualEditorRef.current.getBoundDocumentKey(), pathToSave)
        const canReadBodyFromEditor =
          pathsEqual(activePathRef.current, pathToSave) && editorBoundToSavePath

        let body: string | undefined
        if (canReadBodyFromEditor) {
          let resolved: string | null
          try {
            resolved = await tryResolveBoundEditorMarkdown(
              mainPaneMode,
              visualEditorRef.current,
              contentSnapshotAtRequest,
              pathToSave,
              () => activePathRef.current,
            )
          } catch (error) {
            setStatus(t('app.status.saveFailed', { message: error instanceof Error ? error.message : String(error) }), 'error')
            return
          }
          if (resolved != null) {
            body = resolved
          } else {
            body = resolveActiveAwareSaveBodyFallback({
              pathToSave,
              tabBodySnapshot: tabBodySnapshotAtRequest,
              contentSnapshot: contentSnapshotAtRequest,
              activePath: activePathRef.current,
              activeContent: contentRef.current,
              resolveDocumentBody: resolveDocumentBodyForPath,
            })
          }
        } else {
          body = resolveActiveAwareSaveBodyFallback({
            pathToSave,
            tabBodySnapshot: tabBodySnapshotAtRequest,
            contentSnapshot: contentSnapshotAtRequest,
            activePath: activePathRef.current,
            activeContent: contentRef.current,
            resolveDocumentBody: resolveDocumentBodyForPath,
          })
        }
        if (body == null) {
          setStatus(t('app.status.saveFailed', { message: t('app.status.saveNothingHint') }), 'error')
          return
        }
        const diskMarkdown = diskMarkdownForDocumentSave(pathToSave, body)
        const saveAsProjected = projectSavedMarkdownToEditorSurfaces(mainPaneMode, diskMarkdown)
        commitLatestDocumentBodyToMemory({
          path: pathToSave,
          body: saveAsProjected.editorSurface,
          sourceIdentity: saveAsProjected.sourceIdentity,
          contentRef,
        })
        if (!rootAtRequest) {
          const picked = await save({
            title: t('app.dialog.saveAs'),
            defaultPath: t('app.defaults.untitledMd'),
            filters: [fileDialogFilter(t, 'markdown', ['md', 'markdown'])],
          })
          if (!picked) return
          try {
            await exportNote(exportNotePayload(picked, diskMarkdown, ''))
          } catch (e) {
            setStatus(t('app.status.saveFailed', { message: e instanceof Error ? e.message : String(e) }), 'error')
            return
          }
          setSavedAt(new Date().toLocaleTimeString())
          setStatus(t('app.status.savedTo', { path: picked }), 'success')
          return
        }
        const base = rootAtRequest.replace(/[/\\]+$/u, '')
        const defaultPath =
          pathToSave && !isBufferTabId(pathToSave) ? pathToSave : `${base}/${t('app.defaults.newNoteStem')}.md`
        const picked = await save({
          title: t('app.dialog.saveAs'),
          defaultPath,
          filters: [fileDialogFilter(t, 'markdown', ['md', 'markdown'])],
        })
        if (!picked) return
        if (!isPathUnderWorkspace(rootAtRequest, picked)) {
          setStatus(t('app.status.saveOutsideWorkspace'), 'warning')
          return
        }
        try {
          await dispatchSaveDocumentWithEncryptionRetry({
            rootAtRequest,
            getCurrentRootDir: () => rootDirRef.current,
            path: picked,
            content: diskMarkdown,
            source: 'save-as',
            allowUnlockRetry: true,
            promptWorkspacePassword,
            t,
          })
        } catch (error) {
          await handleWorkspaceDocumentSaveError(error, {
            manual: true,
            rootAtRequest,
            path: picked,
            local: diskMarkdown,
            setSaveConflict,
            setStatus,
            t,
          })
          return
        }
        resetModeSwitchEditorBootstrap()
        await dispatchDocumentCommand({
          type: 'REPLACE_ACTIVE_DOCUMENT',
          path: picked,
          content: diskMarkdown,
          source: 'save-as',
        })
        const savedAtMs = Date.now()
        onWorkspaceDocumentSaved?.(picked, savedAtMs)
        updateRecent(picked)
        await refreshFileTree()
        await refreshWorkspaceIndex(rootAtRequest)
        setSavedAt(new Date().toLocaleTimeString())
        setStatus(t('app.status.saved'), 'success')
      })
    }, [
      activePathRef,
      contentRef,
      promptWorkspacePassword,
      rootDir,
      rootDirRef,
      mainPaneMode,
      refreshFileTree,
      onWorkspaceDocumentSaved,
      updateRecent,
      resetModeSwitchEditorBootstrap,
      resolveDocumentBodyForPath,
      setSaveConflict,
      setSavedAt,
      setStatus,
      t,
      visualEditorRef,
    ])

  const runAppPrint = useCallback(async () => {
    if (!activePath) {
      setStatus(t('app.status.exportNoFile'), 'info')
      return
    }
    suppressMarkdownSerdeRef.current = false
    try {
      const exportMarkdown = await resolveMarkdownForSave(
        mainPaneMode,
        visualEditorRef.current,
        contentRef.current,
        activePath,
      )
      const unnamed = t('app.tab.unnamed')
      const stem = isBufferTabId(activePath)
        ? (bufferTabLabels[activePath] || unnamed).replace(/\.(md|markdown)$/i, '') || unnamed
        : defaultExportBasename(activePath)
      const sourcePath = isBufferTabId(activePath) ? '' : activePath
      const html = await buildPdfExportHtml(exportMarkdown, {
        title: stem,
        dark: isDark,
        sourcePath,
        rootDir: rootDir || undefined,
      })
      setStatus(t('app.status.printOpening'), 'info')
      await openPrintableHtml(html, stem)
    } catch (error) {
      if (error instanceof PrintPermissionRequiredError) {
        setStatus(t('app.status.printPermissionRequired'), 'warning')
        return
      }
      if (error instanceof PrintContentTooLargeError) {
        setStatus(t('app.status.printContentTooLarge'), 'warning')
        return
      }
      if (error instanceof PrintWindowTimedOutError) {
        setStatus(t('app.status.printTimedOut'), 'warning')
        return
      }
      if (error instanceof PrintPopupBlockedError) {
        setStatus(t('app.status.printPopupBlocked'), 'warning')
        return
      }
      const rawMessage = error instanceof Error ? error.message : String(error)
      if (/not allowed|denied|permission|forbidden|allow-print/i.test(rawMessage)) {
        setStatus(t('app.status.printPermissionRequired'), 'warning')
        return
      }
      setStatus(t('app.status.exportFailed', { message: humanizeExportError(error, t) }), 'error')
    }
  }, [
    activePath,
    bufferTabLabels,
    contentRef,
    isDark,
    mainPaneMode,
    rootDir,
    setStatus,
    suppressMarkdownSerdeRef,
    t,
    visualEditorRef,
  ])

  return { saveCurrent, saveAsCurrent, runAppExportFormat, runAppPrint }
}
