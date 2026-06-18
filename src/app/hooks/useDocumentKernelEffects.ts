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
import { installTabBodiesKernelSync } from '../document/tabBodiesStore'
import { isBufferTabId } from '../workspace/constants'
import { statNoteFile } from '../../platform/tauri/documentService'
import {
  checkBlankContentSuspect,
  isTabNavLogEnabled,
  logTabNav,
  snapshotDocumentBodyMeta,
} from '../../lib/tabNavigationDebug'
import { MAX_OPEN_DOCUMENT_TABS } from '../document/openTabLimits'
import type { AppStatusTone } from './useAppStatus'

export type DocumentKernelEffectsDeps = {
  rootDir: string
  fileStatRef: MutableRefObject<Record<string, { modifiedSecs: number; size: number }>>
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
    fileStatRef,
    activePathRef,
    contentRef,
    focusActiveEditor,
    resetModeSwitchEditorBootstrap,
    bumpColdOpenGeneration,
    updateRecent,
    logModeSwitchState,
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
      if (!rootDir || !path || isBufferTabId(path) || !isTauri()) return
      try {
        const stat = await statNoteFile(rootDir, path)
        fileStatRef.current[path] = stat
      } catch {
        /* ignore stat failures */
      }
    },
    [rootDir, fileStatRef],
  )

  useEffect(() => {
    registerDocumentRuntimeCapabilities({
      ...documentIO,
      writeDocument: async (root, path, content, options) => {
        const expected =
          options?.forceOverwrite ? undefined : fileStatRef.current[path]?.modifiedSecs
        await documentIO.writeDocument(root, path, content, {
          expectedModifiedSecs: expected,
          forceOverwrite: options?.forceOverwrite,
        })
      },
      readDocument: async (root, path) => {
        logModeSwitchState('DocumentRuntimeKernel:readNote')
        resetModeSwitchEditorBootstrap()
        bumpColdOpenGeneration()
        const raw = await documentIO.readDocument(root, path)
        return normalizeLineEndings(raw)
      },
      readDocumentForVerify: async (root, path) => {
        const raw = await documentIO.readDocument(root, path)
        return normalizeLineEndings(raw)
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
          void recordFileStat(path)
        }
      },
      onDocumentSaved: (root, path, markdown) => {
        void root
        if (!isBufferTabId(path)) {
          notifyKnowledgeDocumentSave(path, markdown)
          void recordFileStat(path)
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
    focusActiveEditor,
    logModeSwitchState,
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
