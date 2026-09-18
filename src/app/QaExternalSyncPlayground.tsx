import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import '../App.css'
import { I18nProvider, useI18n } from '../i18n'
import { getEnMessagesSnapshot, getLocaleMessagesSnapshot, getLocaleRawSnapshot } from '../i18n/localeRegistry'
import { EditorTabBar } from './components/EditorTabBar'
import { SaveConflictDialog } from './components/SaveConflictDialog'
import { TiptapMarkdownEditor, type TiptapMarkdownEditorHandle } from '../editor/TiptapMarkdownEditor'
import { EditorOpenReason } from '../editor/editorOpenReason'
import { syncDocumentFrontmatterFromMarkdown } from '../editor/documentFrontmatterStore'
import { setSourceModeIdentity } from '../editor/sourceModeIdentity'
import { projectDocumentMemorySurfaces } from '../lib/editorContentSync'
import { isPathDirty } from '../lib/documentDirty'
import { clearExternalDiskDriftInState } from '../lib/externalDiskDriftState'
import {
  resolveEditorOverlayChrome,
  resolveEditorPersistentStatusMessage,
} from '../lib/editorRestoreExternalChrome'
import {
  getHistoryRestoreRevision,
  getHistoryRestoreState,
  isAutosaveSuspended,
  subscribeHistoryRestoreState,
  suspendAutosaveForPath,
} from '../documentHistory/historyRestoreState'
import { normalizeLineEndings } from '../lib/normalizeLineEndings'
import { pathsEqual } from '../lib/workspacePathUtils'
import {
  dispatchDocumentCommand,
  getDocumentRuntimeSnapshot,
  getDocumentSavedContent,
  registerDocumentRuntimeCapabilities,
  resetDocumentRuntimeKernel,
} from '../documentRuntime/documentKernel'
import {
  clearTabBodies,
  deleteTabBody,
  getTabBody,
  installTabBodiesKernelSync,
  setTabBody,
} from './document/tabBodiesStore'
import {
  isSaveConflictPromptPending,
  promptExternalDriftConflict,
  resolveSaveConflictPrompt,
} from './document/saveConflictPrompt'
import type { SaveConflictState } from './document/saveConflictState'
import {
  applyDiskFromSaveConflict,
  keepLocalEditsFromExternalDrift,
} from './hooks/historyConflictOverlayActions'
import { markAppSettingsHydratedForTests } from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'

const QA_ROOT = '/qa-vault-external-sync'
const QA_DOC = `${QA_ROOT}/notes/active.md`
const QA_DOC_B = `${QA_ROOT}/notes/other.md`

const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

const INITIAL_MARKDOWN = '# Active Doc\n\nORIGINAL-CONTENT\n'
const INITIAL_MARKDOWN_B = '# Other Doc\n\nOTHER-ORIGINAL\n'

const TAB_MESSAGES: Record<string, string> = {
  'app.tabs.aria': 'Document tabs',
  'app.tabs.unsavedAria': 'unsaved changes',
  'app.tabs.externalAria': 'changed on disk',
  'app.tabs.historyRestoreAria': 'restored from history',
  'app.tabs.historyRestoreHint': 'Restored from history; save to write disk',
  'app.history.banner': 'Restored from history; save to write disk',
  'app.tabs.close': 'Close tab',
  'app.tabs.closeTab': 'Close tab',
  'app.tabs.closeOthers': 'Close other tabs',
  'app.tabs.closeAll': 'Close all tabs',
  'app.tabs.countAria': '{current} of {max} tabs open',
  'app.tabs.listMenuAria': 'Show all open tabs ({current}/{max})',
  'app.tabs.listMenuTitle': 'Open tabs',
  'app.tabs.limitHint': 'Tab limit approaching',
  'app.tabs.limitReached': 'Tab limit reached',
  'app.tabs.reloadFromDisk': 'Reload from disk',
  'app.tabs.reloadFromDiskHint': 'Reload this tab from disk',
  'app.statusbar.reloadFromDisk': 'Reload from disk',
  'app.statusbar.unsaved': 'Unsaved changes',
  'app.statusbar.ready': 'Ready',
  'menu.file.save': 'Save',
}

function tabBarT(key: string): string {
  return TAB_MESSAGES[key] ?? key
}

type FileStat = { modifiedSecs: number; size: number }

declare global {
  interface Window {
    __QA_EXTERNAL_SYNC__?: {
      getActivePath: () => string
      getDiskContent: (path?: string) => string
      getEditorPlainText: () => string
      isPathDirty: (path?: string) => boolean
      hasExternalDiskBadge: (tabFileName?: string) => boolean
      getExternalDriftPaths: () => string[]
      simulateExternalDiskChange: (markdown: string, path?: string) => void
      triggerExternalRefresh: () => void
      activateTab: (path: string) => Promise<void>
      editActive: (markdown: string) => Promise<void>
      isSaveConflictOpen: () => boolean
      simulateExternalDriftOnly: (markdown: string, path?: string) => void
      reloadFromDisk: (path?: string) => Promise<void>
      saveActiveDocument: () => Promise<boolean>
      simulateHistoryRestorePending: (path?: string) => void
      hasHistoryRestorePending: (path?: string) => boolean
      hasHistoryRestoreBadge: (tabFileName?: string) => boolean
    }
  }
}

function QaExternalSyncInner() {
  const { t } = useI18n()
  const [status, setStatus] = useState('booting')
  const [openedTabs, setOpenedTabs] = useState<string[]>([QA_DOC, QA_DOC_B])
  const [activePath, setActivePath] = useState(QA_DOC)
  const [content, setContent] = useState(INITIAL_MARKDOWN)
  const [externalDiskChangedPaths, setExternalDiskChangedPaths] = useState<Set<string>>(() => new Set())
  const [saveConflict, setSaveConflict] = useState<SaveConflictState | null>(null)
  const [saveConflictResolving, setSaveConflictResolving] = useState(false)
  const [coldOpenGeneration, setColdOpenGeneration] = useState(0)
  const [editorOpenReason] = useState(EditorOpenReason.ColdOpen)

  const contentRef = useRef(INITIAL_MARKDOWN)
  const activePathRef = useRef(QA_DOC)
  const openedTabsRef = useRef<string[]>([QA_DOC, QA_DOC_B])
  const diskStoreRef = useRef<Record<string, string>>({
    [QA_DOC]: INITIAL_MARKDOWN,
    [QA_DOC_B]: INITIAL_MARKDOWN_B,
  })
  const fileStatRef = useRef<Record<string, FileStat>>({
    [QA_DOC]: { modifiedSecs: 1000, size: INITIAL_MARKDOWN.length },
    [QA_DOC_B]: { modifiedSecs: 1000, size: INITIAL_MARKDOWN_B.length },
  })
  const visualEditorRef = useRef<TiptapMarkdownEditorHandle | null>(null)
  const suppressMarkdownSerdeRef = useRef(false)
  const pendingExternalReloadRef = useRef(false)
  const saveConflictRef = useRef(saveConflict)

  activePathRef.current = activePath
  contentRef.current = content
  openedTabsRef.current = openedTabs
  saveConflictRef.current = saveConflict

  const bumpColdOpenGeneration = useCallback(() => {
    setColdOpenGeneration((value) => value + 1)
  }, [])

  const tabLabel = useCallback((path: string) => path.split('/').pop() ?? path, [])

  const editorPlainText = useCallback((): string => {
    const editor = visualEditorRef.current?.getEditor()
    if (!editor) return ''
    return editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n', '\n')
  }, [])

  const persistEditorToTabStores = useCallback((path: string, markdown: string) => {
    setTabBody(path, markdown)
  }, [])

  const markExternalDiskDrift = useCallback((path: string) => {
    setExternalDiskChangedPaths((prev) => {
      const next = new Set(prev)
      next.add(path)
      return next
    })
  }, [])

  const clearExternalDiskDrift = useCallback((path: string) => {
    setExternalDiskChangedPaths((prev) => clearExternalDiskDriftInState(prev, path))
  }, [])

  const refreshActiveEditorAfterPathReload = useCallback(
    (path: string) => {
      if (!pathsEqual(path, activePathRef.current)) return
      bumpColdOpenGeneration()
    },
    [bumpColdOpenGeneration],
  )

  const onSaveConflictCancel = useCallback(() => {
    if (saveConflictResolving) return
    if (isSaveConflictPromptPending()) resolveSaveConflictPrompt('cancel')
    setSaveConflict(null)
    setStatus('external-conflict-cancel')
  }, [saveConflictResolving])

  const onSaveConflictUseDisk = useCallback(() => {
    void (async () => {
      const conflict = saveConflictRef.current
      if (!conflict) return
      setSaveConflictResolving(true)
      try {
        const ok = await applyDiskFromSaveConflict({
          conflict,
          rootDir: QA_ROOT,
          dispatchDocumentCommand,
          refreshActiveEditorAfterPathReload,
          setStatus: (msg) => setStatus(`conflict-disk:${msg}`),
          t,
        })
        if (ok) {
          clearExternalDiskDrift(conflict.path)
          if (isSaveConflictPromptPending()) resolveSaveConflictPrompt('disk')
          setSaveConflict(null)
          setStatus('external-conflict-used-disk')
        } else if (isSaveConflictPromptPending()) {
          resolveSaveConflictPrompt('cancel')
        }
      } finally {
        setSaveConflictResolving(false)
      }
    })()
  }, [clearExternalDiskDrift, refreshActiveEditorAfterPathReload, t])

  const onSaveConflictKeepLocal = useCallback(() => {
    void (async () => {
      const conflict = saveConflictRef.current
      if (!conflict) return
      setSaveConflictResolving(true)
      try {
        const ok = await keepLocalEditsFromExternalDrift({
          conflict,
          setStatus: (msg) => setStatus(`conflict-local:${msg}`),
          t,
        })
        if (ok) {
          clearExternalDiskDrift(conflict.path)
          if (isSaveConflictPromptPending()) resolveSaveConflictPrompt('local')
          setSaveConflict(null)
          setStatus('external-conflict-kept-local-edits')
        } else if (isSaveConflictPromptPending()) {
          resolveSaveConflictPrompt('cancel')
        }
      } finally {
        setSaveConflictResolving(false)
      }
    })()
  }, [clearExternalDiskDrift, t])

  const reloadPathAfterExternalChange = useCallback(
    async (path: string, isActive: boolean): Promise<void> => {
      const disk = diskStoreRef.current[path]
      if (disk == null) return

      if (isPathDirty(path)) {
        markExternalDiskDrift(path)
        if (!isActive) {
          setStatus('external-drift-inactive')
          return
        }
        const local = getTabBody(path) ?? getDocumentSavedContent(path) ?? ''
        const result = await promptExternalDriftConflict({
          rootDir: QA_ROOT,
          path,
          local,
          setSaveConflict,
          setStatus: (msg, tone) => setStatus(`${tone ?? 'info'}:${msg}`),
          t,
        })
        if (result === 'disk' || result === 'local') {
          clearExternalDiskDrift(path)
          bumpColdOpenGeneration()
        }
        return
      }

      const saved = getDocumentSavedContent(path)
      if (saved !== undefined && normalizeLineEndings(disk) === normalizeLineEndings(saved)) {
        setTabBody(path, disk)
        if (isActive) setStatus('external-no-op')
        return
      }

      clearExternalDiskDrift(path)
      if (isActive) {
        await dispatchDocumentCommand({
          type: 'REVERT_DOCUMENT',
          root: QA_ROOT,
          path,
          source: 'external-fs-reload',
        })
        bumpColdOpenGeneration()
        setStatus('external-reloaded')
      }
    },
    [bumpColdOpenGeneration, clearExternalDiskDrift, markExternalDiskDrift, t],
  )

  const reloadOpenFilesAfterExternalChange = useCallback(async () => {
    const snap = getDocumentRuntimeSnapshot()
    const pathsToCheck = [...new Set([snap.activePath, ...snap.openedTabs].filter(Boolean))]
    for (const path of pathsToCheck) {
      const stat = fileStatRef.current[path]
      const disk = diskStoreRef.current[path]
      if (!stat || disk == null) continue
      const isActive = pathsEqual(path, snap.activePath)
      await reloadPathAfterExternalChange(path, isActive)
    }
  }, [reloadPathAfterExternalChange])

  const simulateExternalDiskChange = useCallback((markdown: string, pathArg?: string) => {
    const path = pathArg ?? activePathRef.current
    diskStoreRef.current[path] = markdown
    const prev = fileStatRef.current[path] ?? { modifiedSecs: 1000, size: 0 }
    fileStatRef.current[path] = {
      modifiedSecs: prev.modifiedSecs + 1,
      size: markdown.length,
    }
    pendingExternalReloadRef.current = true
    setStatus(`external-simulated:${path.split('/').pop() ?? path}`)
  }, [])

  const triggerExternalRefresh = useCallback(() => {
    if (!pendingExternalReloadRef.current) return
    pendingExternalReloadRef.current = false
    void reloadOpenFilesAfterExternalChange()
  }, [reloadOpenFilesAfterExternalChange])

  const simulateExternalDriftOnly = useCallback(
    (markdown: string, pathArg?: string) => {
      const path = pathArg ?? activePathRef.current
      diskStoreRef.current[path] = markdown
      const prev = fileStatRef.current[path] ?? { modifiedSecs: 1000, size: 0 }
      fileStatRef.current[path] = {
        modifiedSecs: prev.modifiedSecs + 1,
        size: markdown.length,
      }
      markExternalDiskDrift(path)
      setStatus(`external-drift-only:${path.split('/').pop() ?? path}`)
    },
    [markExternalDiskDrift],
  )

  const simulateHistoryRestorePending = useCallback((pathArg?: string) => {
    const path = pathArg ?? activePathRef.current
    if (!path) return
    suspendAutosaveForPath(path, 'qa-history-snap')
    setStatus('history-restore-pending')
  }, [])

  const saveActiveDocument = useCallback(async (): Promise<boolean> => {
    const path = activePathRef.current
    if (!path) return false
    const body = getTabBody(path) ?? contentRef.current
    try {
      await dispatchDocumentCommand({
        type: 'SAVE_DOCUMENT',
        root: QA_ROOT,
        path,
        content: body,
        source: 'qa-external-sync-save',
      })
      clearExternalDiskDrift(path)
      setStatus('external-saved')
      return true
    } catch {
      setStatus('external-save-failed')
      return false
    }
  }, [clearExternalDiskDrift])

  const reloadFromDisk = useCallback(
    async (pathArg?: string) => {
      const path = pathArg ?? activePathRef.current
      const isActive = pathsEqual(path, activePathRef.current)
      await reloadPathAfterExternalChange(path, isActive)
    },
    [reloadPathAfterExternalChange],
  )

  const activateTab = useCallback(
    async (tabPath: string) => {
      if (pathsEqual(tabPath, activePathRef.current)) return

      const hadExternalChange = [...externalDiskChangedPaths].some((p) => pathsEqual(p, tabPath))
      if (hadExternalChange && isPathDirty(tabPath)) {
        const local = getTabBody(tabPath) ?? getDocumentSavedContent(tabPath) ?? ''
        const result = await promptExternalDriftConflict({
          rootDir: QA_ROOT,
          path: tabPath,
          local,
          setSaveConflict,
          setStatus: (msg, tone) => setStatus(`${tone ?? 'info'}:${msg}`),
          t,
        })
        if (result === 'disk') {
          clearExternalDiskDrift(tabPath)
          deleteTabBody(tabPath)
          bumpColdOpenGeneration()
        } else if (result === 'local') {
          clearExternalDiskDrift(tabPath)
        } else {
          markExternalDiskDrift(tabPath)
          return
        }
      } else if (hadExternalChange) {
        clearExternalDiskDrift(tabPath)
      }

      const body = getTabBody(tabPath) ?? diskStoreRef.current[tabPath] ?? ''
      activePathRef.current = tabPath
      setActivePath(tabPath)
      contentRef.current = body
      setContent(body)
      await dispatchDocumentCommand({
        type: 'REPLACE_ACTIVE_DOCUMENT',
        path: tabPath,
        content: body,
        source: 'qa-external-sync-activate',
      })
      bumpColdOpenGeneration()
      setStatus(`activated:${tabLabel(tabPath)}`)
    },
    [
      bumpColdOpenGeneration,
      clearExternalDiskDrift,
      externalDiskChangedPaths,
      markExternalDiskDrift,
      tabLabel,
      t,
    ],
  )

  const editActive = useCallback(
    async (markdown: string) => {
      const path = activePathRef.current
      if (!path) return
      contentRef.current = markdown
      setContent(markdown)
      persistEditorToTabStores(path, markdown)
      await dispatchDocumentCommand({
        type: 'DOCUMENT_CONTENT_CHANGED',
        path,
        content: markdown,
        source: 'qa-external-sync-edit',
      })
    },
    [persistEditorToTabStores],
  )

  useEffect(() => {
    markAppSettingsHydratedForTests({ ...DEFAULT_APP_SETTINGS, language: 'en' })
  }, [])

  useEffect(() => {
    resetDocumentRuntimeKernel()
    clearTabBodies()
    diskStoreRef.current = {
      [QA_DOC]: INITIAL_MARKDOWN,
      [QA_DOC_B]: INITIAL_MARKDOWN_B,
    }
    fileStatRef.current[QA_DOC] = { modifiedSecs: 1000, size: INITIAL_MARKDOWN.length }
    fileStatRef.current[QA_DOC_B] = { modifiedSecs: 1000, size: INITIAL_MARKDOWN_B.length }

    registerDocumentRuntimeCapabilities({
      readDocument: async (_root, path) => {
        const body = diskStoreRef.current[path]
        if (body == null) throw new Error(`missing:${path}`)
        return body
      },
      readDocumentForVerify: async (_root, path) => {
        const body = diskStoreRef.current[path]
        if (body == null) throw new Error(`missing:${path}`)
        return body
      },
      writeDocument: async (_root, path, markdown) => {
        diskStoreRef.current[path] = markdown
        const stat = fileStatRef.current[path] ?? { modifiedSecs: 1000, size: 0 }
        fileStatRef.current[path] = { modifiedSecs: stat.modifiedSecs, size: markdown.length }
      },
      setActiveDocument: (path, markdown) => {
        const projected = projectDocumentMemorySurfaces(path, markdown)
        activePathRef.current = path
        contentRef.current = projected.editorSurface
        setActivePath(path)
        setContent(projected.editorSurface)
        setSourceModeIdentity(path, projected.sourceIdentity)
        syncDocumentFrontmatterFromMarkdown(path, projected.sourceIdentity)
      },
      renderContent: (markdown) => {
        const path = activePathRef.current
        if (!path) return
        const projected = projectDocumentMemorySurfaces(path, markdown)
        contentRef.current = projected.editorSurface
        setContent(projected.editorSurface)
        setSourceModeIdentity(path, projected.sourceIdentity)
      },
      setTabs: (tabs) => {
        setOpenedTabs(Array.isArray(tabs) ? [...tabs] : tabs([QA_DOC, QA_DOC_B]))
      },
      onDocumentOpened: () => undefined,
      onDocumentSaved: (_root, path, markdown) => {
        diskStoreRef.current[path] = markdown
      },
      onOpenTabLimitReached: () => undefined,
    })

    const unsubBodies = installTabBodiesKernelSync()

    void (async () => {
      await dispatchDocumentCommand({
        type: 'RESTORE_WORKSPACE',
        root: QA_ROOT,
        activePath: QA_DOC,
        openTabs: [QA_DOC, QA_DOC_B],
        source: 'qa-external-sync-boot',
      })
      setStatus('ready')
    })()

    return () => {
      unsubBodies()
      resetDocumentRuntimeKernel()
      clearTabBodies()
    }
  }, [])

  const historyRestoreRevision = useSyncExternalStore(
    subscribeHistoryRestoreState,
    getHistoryRestoreRevision,
    getHistoryRestoreRevision,
  )
  const activeHistoryRestorePending =
    historyRestoreRevision >= 0 && activePath ? getHistoryRestoreState(activePath) != null : false
  const activeExternalDrift = [...externalDiskChangedPaths].some((path) => pathsEqual(path, activePath))
  const footerChrome = resolveEditorOverlayChrome({
    statusbarVisible: true,
    historyRestorePending: activeHistoryRestorePending,
    externalDrift: activeExternalDrift,
  })
  const footerMessage = resolveEditorPersistentStatusMessage({
    t: tabBarT,
    statusbarVisible: true,
    historyRestorePending: activeHistoryRestorePending,
    externalDrift: activeExternalDrift,
    dirty: isPathDirty(activePath),
    workspaceLoadingLabelKey: null,
    savedAt: '',
  })

  useEffect(() => {
    window.__QA_EXTERNAL_SYNC__ = {
      getActivePath: () => activePathRef.current,
      getDiskContent: (path) => diskStoreRef.current[path ?? activePathRef.current] ?? '',
      getEditorPlainText: editorPlainText,
      isPathDirty: (path) => isPathDirty(path ?? activePathRef.current),
      hasExternalDiskBadge: (tabFileName) => {
        const name = tabFileName ?? 'active.md'
        return Boolean(
          document.querySelector(
            `[data-testid="editor-tab-external-reload:${name}"], [data-testid="editor-tab:${name}"] .editor-tab-badge--external`,
          ),
        )
      },
      hasHistoryRestoreBadge: (tabFileName) => {
        const name = tabFileName ?? 'active.md'
        return Boolean(
          document.querySelector(`[data-testid="editor-tab:${name}"] .editor-tab-badge--history`),
        )
      },
      getExternalDriftPaths: () => [...externalDiskChangedPaths],
      simulateExternalDiskChange,
      triggerExternalRefresh,
      activateTab,
      editActive,
      isSaveConflictOpen: () => saveConflictRef.current != null,
      simulateExternalDriftOnly,
      reloadFromDisk,
      saveActiveDocument,
      simulateHistoryRestorePending,
      hasHistoryRestorePending: (path) => isAutosaveSuspended(path ?? activePathRef.current),
    }
    return () => {
      delete window.__QA_EXTERNAL_SYNC__
    }
  }, [
    activateTab,
    editActive,
    editorPlainText,
    externalDiskChangedPaths,
    reloadFromDisk,
    saveActiveDocument,
    simulateExternalDiskChange,
    simulateExternalDriftOnly,
    simulateHistoryRestorePending,
    triggerExternalRefresh,
  ])

  const visualDocumentKey = `visual:${activePath}:${coldOpenGeneration}`

  return (
    <div className="qa-external-sync-shell" style={{ padding: 24, minHeight: '100vh', background: 'var(--surface-app)' }}>
      <h1 data-testid="qa-ready">External sync QA</h1>
      <p data-testid="qa-status">{status}</p>

      <EditorTabBar
        t={tabBarT}
        openedTabs={openedTabs}
        activePath={activePath}
        externalDiskChangedPaths={externalDiskChangedPaths}
        tabLabel={tabLabel}
        onActivate={(path) => {
          void activateTab(path)
        }}
        onClose={() => undefined}
        onReorder={() => undefined}
        onContextMenu={() => undefined}
        onExternalBadgeClick={(path) => {
          void reloadFromDisk(path)
        }}
      />

      <div
        className="preview-pane markdown-visual-editor qa-external-sync-editor"
        style={{ maxWidth: 980, minHeight: 280, marginTop: 16 }}
      >
        <TiptapMarkdownEditor
          ref={visualEditorRef}
          documentKey={visualDocumentKey}
          markdown={content}
          activePath={activePath}
          rootDir={QA_ROOT}
          sidebarListMode="outline"
          suppressMarkdownSyncRef={suppressMarkdownSerdeRef}
          onMarkdownChange={(next) => {
            contentRef.current = next
            setContent(next)
            const path = activePathRef.current
            if (!path) return
            persistEditorToTabStores(path, next)
            void dispatchDocumentCommand({
              type: 'DOCUMENT_CONTENT_CHANGED',
              path,
              content: next,
              source: 'qa-external-sync-change',
            })
          }}
          onActiveHeadingChange={() => {}}
          onSelectionActivity={() => {}}
          onStatus={() => {}}
          onOutlineHeadingsChange={() => {}}
          onPasteImage={async () => null}
          openReason={editorOpenReason}
        />
      </div>

      {(footerChrome.showHistorySaveCta || footerChrome.showExternalReloadCta) ? (
        <footer
          className="editor-footer editor-footer--stats-enabled"
          style={{ marginTop: 12, maxWidth: 980 }}
          data-testid="qa-editor-footer"
        >
          <span className="editor-footer-message editor-footer-persistent" data-testid="qa-editor-footer-message">
            {footerMessage}
            {footerChrome.showHistorySaveCta ? (
              <button
                type="button"
                className="editor-footer-reload-cta"
                data-testid="editor-history-restore-save"
                onClick={() => {
                  void saveActiveDocument()
                }}
              >
                {tabBarT('menu.file.save')}
              </button>
            ) : null}
            {footerChrome.showExternalReloadCta ? (
              <button
                type="button"
                className="editor-footer-reload-cta"
                data-testid="editor-reload-from-disk"
                onClick={() => {
                  void reloadFromDisk(activePath)
                }}
              >
                {tabBarT('app.statusbar.reloadFromDisk')}
              </button>
            ) : null}
          </span>
        </footer>
      ) : null}

      <button
        type="button"
        data-testid="qa-save-active"
        style={{ marginTop: 12 }}
        onClick={() => {
          void saveActiveDocument()
        }}
      >
        Save active
      </button>

      <SaveConflictDialog
        t={t}
        open={saveConflict != null}
        path={saveConflict?.path ?? ''}
        basePreview={saveConflict?.base ?? ''}
        localPreview={saveConflict?.local ?? ''}
        diskPreview={saveConflict?.disk ?? ''}
        diskReadable={saveConflict?.diskReadable ?? true}
        sourceMode={saveConflict?.sourceMode ?? 'external'}
        resolving={saveConflictResolving}
        onCancel={onSaveConflictCancel}
        onUseDisk={onSaveConflictUseDisk}
        onKeepLocal={onSaveConflictKeepLocal}
      />
    </div>
  )
}

export function QaExternalSyncPlayground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaExternalSyncInner />
    </I18nProvider>
  )
}
