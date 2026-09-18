import { useCallback, useEffect, type MutableRefObject, type RefObject } from 'react'
import { isTauri } from '@tauri-apps/api/core'

import type { TranslateFn } from '../../i18n'
import { syncDocumentFrontmatterFromMarkdown } from '../../editor/documentFrontmatterStore'
import { setSourceModeIdentity } from '../../editor/sourceModeIdentity'
import { projectDocumentMemorySurfaces } from '../../lib/editorContentSync'
import {
  notifyKnowledgeDocumentOpen,
  notifyKnowledgeDocumentSave,
} from '../../editor/knowledgeOS/ui/knowledgeAppIntegration'
import {
  registerDocumentRuntimeCapabilities,
} from '../../documentRuntime/documentKernel'
import { installAssetProjection } from '../../documentRuntime/projections/assetProjection'
import { installKnowledgeGraphProjection } from '../../documentRuntime/projections/knowledgeGraphProjection'
import { installPersistenceProjection } from '../../documentRuntime/projections/persistenceProjection'
import { documentIO } from '../../io/documentIO'
import { normalizeLineEndings } from '../../lib/normalizeLineEndings'
import { installTabBodiesKernelSync, getTabBody, projectTabBodyFromKernel } from '../document/tabBodiesStore'
import { diskMarkdownForDocumentSave } from '../../lib/editorContentSync'
import { recordWorkspaceIndexPrefetch } from '../workspace/workspaceIndexContentPrefetch'
import {
  createQaAppRootOutlineDocumentCapabilities,
  isQaAppRootOutlineMode,
} from '../qa/qaAppRootOutlineHarness'
import { isBufferTabId } from '../workspace/constants'
import { getPathKeyedRecordValue, setPathKeyedRecordValue } from '../../lib/workspacePathUtils'
import { statNoteFile } from '../../platform/tauri/documentService'
import {
  checkBlankContentSuspect,
  isTabNavLogEnabled,
  logTabNav,
  snapshotDocumentBodyMeta,
} from '../../lib/tabNavigationDebug'
import { MAX_OPEN_DOCUMENT_TABS } from '../document/openTabLimits'
import type { AppStatusTone } from './useAppStatus'
import { createAutoSnapshotForSavedDocument } from '../../documentHistory/historyService'
import {
  captureFileStatGeneration,
  isFileStatGenerationStale,
} from '../../lib/fileStatGeneration'
import { invalidateEditorBootstrapBeforeDocumentRead } from '../../lib/editorDocumentReadBootstrap'

export type DocumentKernelEffectsDeps = {
  rootDir: string
  rootDirRef: MutableRefObject<string>
  fileStatRef: MutableRefObject<Record<string, { modifiedSecs: number; size: number }>>
  fileStatGenerationRef: MutableRefObject<number>
  activePathRef: RefObject<string>
  contentRef: RefObject<string>
  focusActiveEditor: () => void
  resetModeSwitchEditorBootstrap: () => void
  bumpColdOpenGeneration: () => void
  updateRecent: (path: string) => void
  logModeSwitchState: (phase: string) => void
  setStatus: (msg: string, toneOverride?: AppStatusTone) => void
  showAppAlert: (opts: { title: string; message: string; okLabel?: string }) => Promise<void>
  t: TranslateFn
}

export function useDocumentKernelEffects(deps: DocumentKernelEffectsDeps) {
  const {
    rootDir,
    rootDirRef,
    fileStatRef,
    fileStatGenerationRef,
    activePathRef,
    contentRef,
    focusActiveEditor,
    resetModeSwitchEditorBootstrap,
    bumpColdOpenGeneration,
    updateRecent,
    setStatus,
    showAppAlert,
    t,
  } = deps

  const notifyOpenTabLimitReached = useCallback(async () => {
    await showAppAlert({
      title: t('app.confirm.openTabLimit.title'),
      message: t('app.confirm.openTabLimit.message', { max: MAX_OPEN_DOCUMENT_TABS }),
    })
    setStatus(t('app.status.openTabLimit', { max: MAX_OPEN_DOCUMENT_TABS }), 'warning')
  }, [showAppAlert, setStatus, t])

  const recordFileStat = useCallback(
    async (path: string) => {
      const workspaceRoot = rootDirRef.current.trim()
      if (!workspaceRoot || !path || isBufferTabId(path) || !isTauri()) return
      const capturedGeneration = captureFileStatGeneration(fileStatGenerationRef)
      try {
        const stat = await statNoteFile(workspaceRoot, path)
        if (isFileStatGenerationStale(capturedGeneration, fileStatGenerationRef)) return
        if (rootDirRef.current.trim() !== workspaceRoot) return
        setPathKeyedRecordValue(fileStatRef.current, path, stat)
      } catch {
        /* ignore stat failures */
      }
    },
    [fileStatGenerationRef, fileStatRef, rootDirRef],
  )

  useEffect(() => {
    if (isQaAppRootOutlineMode()) {
      registerDocumentRuntimeCapabilities(createQaAppRootOutlineDocumentCapabilities())
      return () => registerDocumentRuntimeCapabilities(null)
    }
    registerDocumentRuntimeCapabilities({
      ...documentIO,
      writeDocument: async (root, path, content, options) => {
        const expected =
          options?.forceOverwrite
            ? undefined
            : options?.expectedModifiedSecs ??
              getPathKeyedRecordValue(fileStatRef.current, path)?.modifiedSecs
        await documentIO.writeDocument(root, path, content, {
          expectedModifiedSecs: expected,
          forceOverwrite: options?.forceOverwrite,
        })
      },
      readDocument: async (root, path) => {
        const raw = await documentIO.readDocument(root, path)
        return normalizeLineEndings(raw)
      },
      readDocumentForVerify: async (root, path) => {
        const raw = await documentIO.readDocument(root, path)
        return normalizeLineEndings(raw)
      },
      readCachedDocumentForRestore: (path) => {
        const cachedBody = getTabBody(path)
        if (cachedBody == null) return undefined
        return diskMarkdownForDocumentSave(path, cachedBody)
      },
      projectOpenDocumentBody: projectTabBodyFromKernel,
      invalidateEditorBootstrapBeforeDocumentRead: (_path, options) => {
        invalidateEditorBootstrapBeforeDocumentRead(
          resetModeSwitchEditorBootstrap,
          bumpColdOpenGeneration,
          options,
        )
      },
      setActiveDocument: (path, markdown) => {
        const projected =
          path && path !== 'scratch'
            ? projectDocumentMemorySurfaces(path, markdown)
            : { editorSurface: markdown, sourceIdentity: markdown }
        if (isTabNavLogEnabled()) {
          logTabNav('kernel-set-active', {
            source: 'capabilities.setActiveDocument',
            ...snapshotDocumentBodyMeta(path, projected.sourceIdentity),
          })
        }
        checkBlankContentSuspect('capabilities-set-active-document', path, projected.sourceIdentity, {
          source: 'capabilities.setActiveDocument',
        })
        activePathRef.current = path
        contentRef.current = projected.editorSurface
        setSourceModeIdentity(path, projected.sourceIdentity)
        if (path && path !== 'scratch') {
          syncDocumentFrontmatterFromMarkdown(path, projected.sourceIdentity)
        }
        updateRecent(path)
        setStatus(t('app.status.fileLoaded'))
        focusActiveEditor()
      },
      renderContent: (markdown) => {
        const path = activePathRef.current
        if (!path || path === 'scratch') {
          contentRef.current = markdown
          return
        }
        const projected = projectDocumentMemorySurfaces(path, markdown)
        contentRef.current = projected.editorSurface
        setSourceModeIdentity(path, projected.sourceIdentity)
      },
      setTabs: (tabsOrUpdater) => {
        void tabsOrUpdater
      },
      onDocumentOpened: (root, path, markdown) => {
        if (!isBufferTabId(path)) {
          notifyKnowledgeDocumentOpen(path, markdown, root)
          recordWorkspaceIndexPrefetch(root, path, markdown)
          queueMicrotask(() => {
            void recordFileStat(path)
          })
        }
      },
      onDocumentSaved: (root, path, markdown, source) => {
        if (!isBufferTabId(path)) {
          notifyKnowledgeDocumentSave(path, markdown, root)
          void recordFileStat(path)
          void createAutoSnapshotForSavedDocument({
            rootDir: root,
            path,
            content: markdown,
            source: source?.includes('autosave') ? 'autosave' : 'save',
          }).catch(() => undefined)
        }
      },
      onOpenTabLimitReached: () => {
        void notifyOpenTabLimitReached()
      },
    })
    return () => registerDocumentRuntimeCapabilities(null)
  }, [
    activePathRef,
    bumpColdOpenGeneration,
    contentRef,
    fileStatRef,
    fileStatGenerationRef,
    focusActiveEditor,
    notifyOpenTabLimitReached,
    recordFileStat,
    resetModeSwitchEditorBootstrap,
    setStatus,
    t,
    updateRecent,
  ])

  useEffect(() => installTabBodiesKernelSync(), [])
  useEffect(() => installAssetProjection(), [])
  useEffect(() => installPersistenceProjection(), [])
  useEffect(() => installKnowledgeGraphProjection(rootDir), [rootDir])
}
