import { useCallback, useEffect, type MutableRefObject, type RefObject } from 'react'
import { isTauri } from '@tauri-apps/api/core'

import type { TranslateFn } from '../../i18n'
import { setSourceModeIdentity } from '../../editor/sourceModeIdentity'
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
import { installTabBodiesKernelSync } from '../document/tabBodiesStore'
import { isBufferTabId } from '../workspace/constants'
import { statNoteFile } from '../../platform/tauri/documentService'

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
  setStatus: (msg: string) => void
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
    t,
  } = deps

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
        return documentIO.readDocument(root, path)
      },
      readDocumentForVerify: async (root, path) => {
        return documentIO.readDocument(root, path)
      },
      setActiveDocument: (path, markdown) => {
        activePathRef.current = path
        contentRef.current = markdown
        setSourceModeIdentity(path, markdown)
        updateRecent(path)
        setStatus(t('app.status.fileLoaded'))
        focusActiveEditor()
      },
      renderContent: (markdown) => {
        contentRef.current = markdown
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
    })
    return () => registerDocumentRuntimeCapabilities(null)
  }, [
    activePathRef,
    bumpColdOpenGeneration,
    contentRef,
    fileStatRef,
    focusActiveEditor,
    logModeSwitchState,
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
