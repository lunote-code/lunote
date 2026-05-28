import { useCallback, type MutableRefObject, type RefObject } from 'react'
import { save } from '@tauri-apps/plugin-dialog'
import { isTauri } from '@tauri-apps/api/core'

import type { TranslateFn } from '../../i18n'
import {
  defaultExportBasename,
  downloadHtmlBlob,
  markdownToDocxBase64,
  markdownToPlainHtmlFragment,
  resolveExportDocumentClasses,
  markdownToStyledHtmlFragment,
  wrapStandaloneHtml,
  type AppExportFormat,
} from '../../markdownExport'
import { downloadBinaryBlob, markdownToPdfBase64, markdownToPngBase64 } from '../../export/renderedDocumentExport'
import { rewriteExportHtmlMediaSources } from '../export/htmlMedia'
import { exportBinaryPayload, exportNotePayload } from '../../lib/tauriScopedInvoke'
import {
  resolveActiveAwareSaveBodyFallback,
  resolveMarkdownForSave,
  tryResolveBoundEditorMarkdown,
} from '../../lib/editorContentSync'
import { enqueueSave } from '../../lib/saveQueue'
import { isPathDirty } from '../../lib/documentDirty'
import { isPathUnderWorkspace } from '../../lib/workspacePathUtils'
import { dispatchDocumentCommand } from '../../documentRuntime/documentKernel'
import { setTabBody } from '../document/tabBodiesStore'
import { resolveDocumentBody } from '../../documentRuntime/documentAuthority'
import { openSaveConflictDialog, type SaveConflictState } from '../document/saveConflictState'
import { pathsEqual } from '../../lib/workspacePathUtils'
import { isBufferTabId } from '../workspace/constants'
import type { TiptapMarkdownEditorHandle } from '../../editor/TiptapMarkdownEditor'
import { schedulePrimeEditorDiagramPreviews } from '../../editor/runtimeEngine/primeEditorDiagramPreviews'
import type { AssetStorageConfig } from '../../assets/assetStoragePolicy'
import { refreshWorkspaceIndex } from '../workspace/workspaceIndexCoordinator'
import { exportBinaryNote, exportNote } from '../../platform/tauri/documentService'

export type DocumentSaveDeps = {
  t: TranslateFn
  activePath: string
  content: string
  rootDir: string
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
  setStatus: (msg: string) => void
  refreshFileTree: () => Promise<void>
  updateRecent: (path: string) => void
  resetModeSwitchEditorBootstrap: () => void
}

export function useDocumentSave(deps: DocumentSaveDeps) {
  const {
    t,
    activePath,
    content,
    rootDir,
    mainPaneMode,
    isDark,
    bufferTabLabels,
    setBufferTabLabels,
    activePathRef,
    contentRef,
    visualEditorRef,
    suppressMarkdownSerdeRef,
    suppressWorkspaceRefreshUntilRef,
    isVisualEditorBoundToActivePath,
    setSavedAt,
    setSaveConflict,
    setStatus,
    refreshFileTree,
    updateRecent,
    resetModeSwitchEditorBootstrap,
  } = deps

  const runAppExportFormat = useCallback(
    async (format: AppExportFormat) => {
          if (!activePath) {
            setStatus(t('app.status.exportNoFile'))
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
                setStatus(t('app.status.downloadHtmlStyled'))
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
                setStatus(t('app.status.downloadHtmlPlain'))
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
                setStatus(t('app.status.downloadPdf'))
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
                setStatus(t('app.status.downloadImage'))
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
                setStatus(t('app.status.downloadWord'))
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
                filters: [{ name: 'PDF', extensions: ['pdf'] }],
              })
              if (!out) return
              await exportBinaryNote(exportBinaryPayload(out, b64, rootDir || ''))
              setStatus(t('app.status.exportedPdf'))
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
                filters: [{ name: 'HTML', extensions: ['html', 'htm'] }],
              })
              if (!out) return
              await exportNote(exportNotePayload(out, html, rootDir || ''))
              setStatus(t('app.status.exportedHtml'))
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
                filters: [{ name: 'HTML', extensions: ['html', 'htm'] }],
              })
              if (!out) return
              await exportNote(exportNotePayload(out, html, rootDir || ''))
              setStatus(t('app.status.exportedHtmlPlain'))
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
                filters: [{ name: 'PNG Image', extensions: ['png'] }],
              })
              if (!out) return
              await exportBinaryNote(exportBinaryPayload(out, b64, rootDir || ''))
              setStatus(t('app.status.exportedImage'))
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
                filters: [{ name: 'Word', extensions: ['docx'] }],
              })
              if (!out) return
              await exportBinaryNote(exportBinaryPayload(out, b64, rootDir || ''))
              setStatus(t('app.status.exportedWord'))
            }
          } catch (e) {
            setStatus(t('app.status.exportFailed', { message: e instanceof Error ? e.message : String(e) }))
          }
    },
    [activePath, bufferTabLabels, isDark, mainPaneMode, rootDir, setStatus, t],
  )

  const resolveDocumentBodyForPath = useCallback(
    (path: string, contentFallback?: string) => {
      return resolveDocumentBody(path, { contentFallback })
    },
    [],
  )

  const saveCurrent = useCallback(
        async (manual = true) => {
          /** Fixed the path when initiating the save to avoid writing to the wrong file due to the tab being cut before the queue is executed.*/
          const pathAtRequest = activePathRef.current ?? ''
          const pathToSave = pathAtRequest || 'scratch'
          const contentSnapshotAtRequest = contentRef.current
          const tabBodySnapshotAtRequest = resolveDocumentBodyForPath(pathToSave, contentSnapshotAtRequest)
          return enqueueSave(async () => {
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
                setStatus(t('app.status.saveFailed', { message: error instanceof Error ? error.message : String(error) }))
                return
              }
              if (resolved != null) {
                body = resolved
                setTabBody(pathToSave, body)
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
                setStatus(t('app.status.saveFailed', { message: t('app.status.editorBinding') }))
                return
              }
            }
            if (body == null) {
              if (manual) {
                setStatus(t('app.status.saveFailed', { message: t('app.status.saveNothingHint') }))
              }
              return
            }
            if (pathsEqual(activePathRef.current, pathToSave) && body !== contentRef.current) {
              suppressMarkdownSerdeRef.current = true
              try {
                contentRef.current = body
                await dispatchDocumentCommand({
                  type: 'DOCUMENT_CONTENT_CHANGED',
                  path: pathToSave,
                  content: body,
                  source: 'save-flush',
                })
              } finally {
                suppressMarkdownSerdeRef.current = false
              }
            }
            if (canReadBodyFromEditor && mainPaneMode === 'visual') {
              schedulePrimeEditorDiagramPreviews(() => {
                const pm = visualEditorRef.current?.getEditor()
                return pm?.view?.dom ?? null
              })
            }
            if (!rootDir) {
              if (!manual) return
              const canExport =
                (Boolean(activePath) && isBufferTabId(activePath)) || isPathDirty(activePath)
              if (!canExport) {
                setStatus(t('app.status.saveNothingHint'))
                return
              }
              const picked = await save({
                title: t('app.dialog.saveMarkdown'),
                defaultPath: t('app.defaults.untitledMd'),
                filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
              })
              if (!picked) return
              try {
                await exportNote(exportNotePayload(picked, body, rootDir || ''))
              } catch (e) {
                setStatus(t('app.status.saveFailed', { message: e instanceof Error ? e.message : String(e) }))
                return
              }
              const name = picked.replace(/\\/g, '/').split('/').pop() ?? t('app.defaults.untitledMd')
              if (activePath && isBufferTabId(activePath)) {
                setBufferTabLabels((prev) => ({ ...prev, [activePath]: name }))
              }
              setSavedAt(new Date().toLocaleTimeString())
              setStatus(t('app.status.savedTo', { path: picked }))
              return
            }
            if (!pathAtRequest) {
              if (!manual) return
              const base = rootDir.replace(/[/\\]+$/u, '')
              const picked = await save({
                title: t('app.dialog.saveAs'),
                defaultPath: `${base}/${t('app.defaults.newNoteStem')}.md`,
                filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
              })
              if (!picked) return
              if (!isPathUnderWorkspace(rootDir, picked)) {
                setStatus(t('app.status.saveOutsideWorkspace'))
                return
              }
              try {
                await dispatchDocumentCommand({
                  type: 'SAVE_DOCUMENT',
                  root: rootDir,
                  path: picked,
                  content: body,
                  source: 'saveCurrent',
                })
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                if (message.includes('FILE_CONFLICT')) {
                  await openSaveConflictDialog({
                    rootDir,
                    path: picked,
                    local: body,
                    setSaveConflict,
                    setStatus,
                    t,
                  })
                  return
                }
                setStatus(t('app.status.saveFailed', { message }))
                return
              }
              resetModeSwitchEditorBootstrap()
              await dispatchDocumentCommand({
                type: 'REPLACE_ACTIVE_DOCUMENT',
                path: picked,
                content: body,
                source: 'save-as',
              })
              updateRecent(picked)
              await refreshFileTree()
              await refreshWorkspaceIndex(rootDir)
              setSavedAt(new Date().toLocaleTimeString())
              setStatus(t('app.status.saved'))
              return
            }
            if (!isPathDirty(pathAtRequest || pathToSave) && !manual) return
            try {
              await dispatchDocumentCommand({
                type: 'SAVE_DOCUMENT',
                root: rootDir,
                path: pathAtRequest || pathToSave,
                content: body,
                source: 'saveCurrent',
              })
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              if (message.includes('FILE_CONFLICT')) {
                await openSaveConflictDialog({
                  rootDir,
                  path: pathAtRequest || pathToSave,
                  local: body,
                  setSaveConflict,
                  setStatus,
                  t,
                })
                return
              }
              setStatus(t('app.status.saveFailed', { message }))
              return
            }
            suppressWorkspaceRefreshUntilRef.current = Date.now() + 2500
            setSavedAt(new Date().toLocaleTimeString())
            if (manual) {
              setStatus(t('app.status.saved'))
            }
          })
    },
    [activePath, content, rootDir, mainPaneMode, refreshFileTree, updateRecent, resetModeSwitchEditorBootstrap, resolveDocumentBodyForPath, setSaveConflict, t, isVisualEditorBoundToActivePath],
  )

  const saveAsCurrent = useCallback(async () => {
      const pathToSave = activePathRef.current || 'scratch'
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
            setStatus(t('app.status.saveFailed', { message: error instanceof Error ? error.message : String(error) }))
            return
          }
          if (resolved != null) {
            body = resolved
            setTabBody(pathToSave, body)
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
          setStatus(t('app.status.saveFailed', { message: t('app.status.saveNothingHint') }))
          return
        }
        if (!rootDir) {
          const picked = await save({
            title: t('app.dialog.saveAs'),
            defaultPath: t('app.defaults.untitledMd'),
            filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
          })
          if (!picked) return
          try {
            await exportNote(exportNotePayload(picked, body, ''))
          } catch (e) {
            setStatus(t('app.status.saveFailed', { message: e instanceof Error ? e.message : String(e) }))
            return
          }
          setSavedAt(new Date().toLocaleTimeString())
          setStatus(t('app.status.savedTo', { path: picked }))
          return
        }
        const base = rootDir.replace(/[/\\]+$/u, '')
        const defaultPath =
          pathToSave && !isBufferTabId(pathToSave) ? pathToSave : `${base}/${t('app.defaults.newNoteStem')}.md`
        const picked = await save({
          title: t('app.dialog.saveAs'),
          defaultPath,
          filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
        })
        if (!picked) return
        if (!isPathUnderWorkspace(rootDir, picked)) {
          setStatus(t('app.status.saveOutsideWorkspace'))
          return
        }
        try {
          await dispatchDocumentCommand({
            type: 'SAVE_DOCUMENT',
            root: rootDir,
            path: picked,
            content: body,
            source: 'save-as',
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (message.includes('FILE_CONFLICT')) {
            await openSaveConflictDialog({
              rootDir,
              path: picked,
              local: body,
              setSaveConflict,
              setStatus,
              t,
            })
            return
          }
          setStatus(t('app.status.saveFailed', { message }))
          return
        }
        resetModeSwitchEditorBootstrap()
        await dispatchDocumentCommand({
          type: 'REPLACE_ACTIVE_DOCUMENT',
          path: picked,
          content: body,
          source: 'save-as',
        })
        updateRecent(picked)
        await refreshFileTree()
        await refreshWorkspaceIndex(rootDir)
        setSavedAt(new Date().toLocaleTimeString())
        setStatus(t('app.status.saved'))
      })
    }, [
      activePath,
      rootDir,
      mainPaneMode,
      refreshFileTree,
      updateRecent,
      resetModeSwitchEditorBootstrap,
      resolveDocumentBodyForPath,
      setSaveConflict,
      t,
      isVisualEditorBoundToActivePath,
    ])

  return { saveCurrent, saveAsCurrent, runAppExportFormat }
}
