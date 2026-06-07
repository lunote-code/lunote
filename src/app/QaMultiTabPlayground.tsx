import { useCallback, useEffect, useRef, useState } from 'react'

import { I18nProvider } from '../i18n'
import { getEnMessagesSnapshot, getLocaleMessagesSnapshot, getLocaleRawSnapshot } from '../i18n/localeRegistry'
import { EditorTabBar } from './components/EditorTabBar'
import { EditorOpenReason } from '../editor/editorOpenReason'
import {
  TiptapMarkdownEditor,
  type TiptapMarkdownEditorHandle,
} from '../editor/TiptapMarkdownEditor'
import { syncDocumentFrontmatterFromMarkdown } from '../editor/documentFrontmatterStore'
import { setSourceModeIdentity } from '../editor/sourceModeIdentity'
import {
  commitLatestDocumentBodyToMemory,
  diskMarkdownForDocumentSave,
  projectDocumentMemorySurfaces,
  projectSavedMarkdownToEditorSurfaces,
  resolveActiveAwareSaveBodyFallback,
  syncActiveDocumentBodyImmediately,
  tryResolveBoundEditorMarkdown,
} from '../lib/editorContentSync'
import { isPathDirty, listDirtyDocumentPaths } from '../lib/documentDirty'
import { enqueueSave } from '../lib/saveQueue'
import { pathsEqual } from '../lib/workspacePathUtils'
import {
  dispatchDocumentCommand,
  registerDocumentRuntimeCapabilities,
  resetDocumentRuntimeKernel,
  subscribeDocumentRuntime,
} from '../documentRuntime/documentKernel'
import { resolveDocumentBody } from '../documentRuntime/documentAuthority'
import {
  clearTabBodies,
  getTabBody,
  getTabBodyCacheSnapshot,
  installTabBodiesKernelSync,
  setTabBody,
} from './document/tabBodiesStore'
import { createRegistryShortcutHandler } from '../menu/shortcutRuntime'
import { markAppSettingsHydratedForTests } from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'
import {
  QA_MULTI_TAB_FIXTURES,
  QA_MULTI_TAB_PATHS,
  QA_MULTI_TAB_ROOT,
  qaMultiTabMarkerForPath,
} from './qaMultiTabFixtures'

declare global {
  interface Window {
    __QA_MULTI_TAB__?: {
      getActivePath: () => string
      getTabOrder: () => string[]
      getDiskContent: (path: string) => string | null
      getEditorPlainText: () => string
      isEditorBlank: () => boolean
      getTabBody: (path: string) => string | undefined
      activateTab: (path: string) => Promise<void>
      editActive: (markdown: string) => Promise<void>
      saveActive: () => Promise<boolean>
      saveProduction: () => Promise<boolean>
      savePath: (path: string) => Promise<boolean>
      saveAllDirty: () => Promise<boolean>
      hasTabDirtyBadge: (tabFileName: string) => boolean
      isPathDirty: (path: string) => boolean
      probeCodeBlockSyncGap: () => {
        cmText: string | null
        pmText: string | null
        pendingCommit: boolean
      }
      rapidSwitch: (paths: string[], rounds: number) => Promise<{ blanks: string[] }>
      resetDiskToFixtures: () => void
    }
  }
}

const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

const TAB_MESSAGES: Record<string, string> = {
  'app.tabs.aria': 'Document tabs',
  'app.tabs.unsavedAria': 'unsaved changes',
  'app.tabs.externalAria': 'changed on disk',
  'app.tabs.historyRestoreAria': 'restored from history',
  'app.tabs.close': 'Close tab',
  'app.tabs.closeTab': 'Close tab',
  'app.tabs.closeOthers': 'Close other tabs',
  'app.tabs.closeAll': 'Close all tabs',
  'app.tabs.countAria': '{current} of {max} tabs open',
  'app.tabs.limitHint': 'Tab limit approaching',
  'app.tabs.limitReached': 'Tab limit reached',
}

function t(key: string): string {
  return TAB_MESSAGES[key] ?? key
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function QaMultiTabInner() {
  const [status, setStatus] = useState('booting')
  const [openedTabs, setOpenedTabs] = useState<string[]>([])
  const [activePath, setActivePath] = useState('')
  const [content, setContent] = useState('')
  const [coldOpenGeneration, setColdOpenGeneration] = useState(0)
  const [editorOpenReason] = useState(EditorOpenReason.ColdOpen)

  const contentRef = useRef('')
  const activePathRef = useRef('')
  const openedTabsRef = useRef<string[]>([])
  const visualEditorRef = useRef<TiptapMarkdownEditorHandle | null>(null)
  const diskStoreRef = useRef<Record<string, string>>({ ...QA_MULTI_TAB_FIXTURES })
  const tabNavGenerationRef = useRef(0)
  const consoleErrorsRef = useRef<string[]>([])
  const suppressMarkdownSerdeRef = useRef(false)
  const kernelContentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [, bumpKernelRevision] = useState(0)

  contentRef.current = content
  activePathRef.current = activePath
  openedTabsRef.current = openedTabs

  const bumpColdOpenGeneration = useCallback(() => {
    setColdOpenGeneration((value) => value + 1)
  }, [])

  const tabLabel = useCallback((path: string) => path.split('/').pop() ?? path, [])

  const editorPlainText = useCallback((): string => {
    return (
      document
        .querySelector('.qa-multi-tab-shell .tiptap-editor-content')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim() ?? ''
    )
  }, [])

  const persistEditorToTabStores = useCallback((tabPath: string, body: string) => {
    if (!tabPath) return
    setTabBody(tabPath, body)
  }, [])

  const resolveDocumentBodyForPath = useCallback(
    (path: string, contentFallback?: string) => resolveDocumentBody(path, { contentFallback }),
    [],
  )

  const cancelPendingKernelContentDebounce = useCallback(() => {
    if (kernelContentDebounceRef.current != null) {
      clearTimeout(kernelContentDebounceRef.current)
      kernelContentDebounceRef.current = null
    }
  }, [])

  const dispatchEditorContentToKernel = useCallback(
    (path: string, value: string, source: string) => {
      cancelPendingKernelContentDebounce()
      const scheduledPath = path
      const scheduledValue = value
      kernelContentDebounceRef.current = setTimeout(() => {
        kernelContentDebounceRef.current = null
        if (!pathsEqual(activePathRef.current, scheduledPath)) return
        void dispatchDocumentCommand({
          type: 'DOCUMENT_CONTENT_CHANGED',
          path: scheduledPath,
          content: scheduledValue,
          source,
        })
      }, 80)
    },
    [cancelPendingKernelContentDebounce],
  )

  const flushEditorToMemory = useCallback(async (): Promise<boolean> => {
    const pathToLeave = activePathRef.current
    if (!pathToLeave) return true
    const contentSnapshot = contentRef.current
    const tabBodySnapshot = resolveDocumentBody(pathToLeave, { contentFallback: contentSnapshot })
    const visualSurface = visualEditorRef.current
    const editorBoundToLeaving =
      visualSurface && pathsEqual(visualSurface.getBoundDocumentKey(), pathToLeave)

    let body: string | undefined
    if (editorBoundToLeaving) {
      const resolved = await tryResolveBoundEditorMarkdown(
        'visual',
        visualSurface,
        contentSnapshot,
        pathToLeave,
        () => activePathRef.current,
      )
      body =
        resolved ??
        resolveActiveAwareSaveBodyFallback({
          pathToSave: pathToLeave,
          tabBodySnapshot,
          contentSnapshot,
          activePath: activePathRef.current,
          activeContent: contentRef.current,
          resolveDocumentBody: (path, fallback) => resolveDocumentBody(path, { contentFallback: fallback }),
        })
    } else {
      body = resolveActiveAwareSaveBodyFallback({
        pathToSave: pathToLeave,
        tabBodySnapshot,
        contentSnapshot,
        activePath: activePathRef.current,
        activeContent: contentRef.current,
        resolveDocumentBody: (path, fallback) => resolveDocumentBody(path, { contentFallback: fallback }),
      })
    }
    if (body == null) return false

    const projected = projectDocumentMemorySurfaces(pathToLeave, body)
    commitLatestDocumentBodyToMemory({
      path: pathToLeave,
      body: projected.editorSurface,
      sourceIdentity: projected.sourceIdentity,
      contentRef,
      persistBody: persistEditorToTabStores,
    })
    await dispatchDocumentCommand({
      type: 'DOCUMENT_CONTENT_CHANGED',
      path: pathToLeave,
      content: projected.editorSurface,
      source: 'qa-memory-flush',
    })
    return true
  }, [persistEditorToTabStores])

  const loadDocumentIntoEditor = useCallback(
    async (path: string, source: string) => {
      const cached = resolveDocumentBody(path)
      if (cached != null && cached.trim().length > 0) {
        const projected = projectDocumentMemorySurfaces(path, cached)
        await dispatchDocumentCommand({
          type: 'REPLACE_ACTIVE_DOCUMENT',
          path,
          content: projected.editorSurface,
          source,
        })
        return
      }
      await dispatchDocumentCommand({
        type: 'OPEN_DOCUMENT',
        root: QA_MULTI_TAB_ROOT,
        path,
        source,
      })
    },
    [],
  )

  const activateTab = useCallback(
    async (path: string) => {
      const target = path.trim()
      if (!target || pathsEqual(target, activePathRef.current)) return
      const generation = ++tabNavGenerationRef.current
      const left = await flushEditorToMemory()
      if (!left || tabNavGenerationRef.current !== generation) return
      bumpColdOpenGeneration()
      await loadDocumentIntoEditor(target, 'qa-activate-tab')
      if (tabNavGenerationRef.current !== generation) return
      await waitMs(120)
    },
    [bumpColdOpenGeneration, flushEditorToMemory, loadDocumentIntoEditor],
  )

  const editActive = useCallback(async (markdown: string) => {
    const path = activePathRef.current
    if (!path) return
    const projected = projectDocumentMemorySurfaces(path, markdown)
    commitLatestDocumentBodyToMemory({
      path,
      body: projected.editorSurface,
      sourceIdentity: projected.sourceIdentity,
      contentRef,
      persistBody: persistEditorToTabStores,
    })
    setContent(projected.editorSurface)
    await dispatchDocumentCommand({
      type: 'DOCUMENT_CONTENT_CHANGED',
      path,
      content: projected.editorSurface,
      source: 'qa-edit-active',
    })
    await waitMs(80)
  }, [persistEditorToTabStores])

  const saveProduction = useCallback(async (): Promise<boolean> => {
    const pathAtRequest = activePathRef.current
    if (!pathAtRequest) return false
    const pathToSave = pathAtRequest
    const contentSnapshotAtRequest = contentRef.current
    const tabBodySnapshotAtRequest = resolveDocumentBodyForPath(pathToSave, contentSnapshotAtRequest)
    try {
      await enqueueSave(async () => {
        cancelPendingKernelContentDebounce()
        suppressMarkdownSerdeRef.current = false
        const visualSurface = visualEditorRef.current
        const editorBoundToSavePath =
          !visualSurface || pathsEqual(visualSurface.getBoundDocumentKey(), pathToSave)
        const canReadBodyFromEditor = pathsEqual(activePathRef.current, pathToSave) && editorBoundToSavePath

        let body: string | undefined
        if (canReadBodyFromEditor && visualSurface) {
          const resolved = await tryResolveBoundEditorMarkdown(
            'visual',
            visualSurface,
            contentSnapshotAtRequest,
            pathToSave,
            () => activePathRef.current,
          )
          if (resolved != null) {
            body = resolved
            const projectedFromResolved = projectSavedMarkdownToEditorSurfaces('visual', body)
            setTabBody(pathToSave, projectedFromResolved.editorSurface)
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
        if (body == null) throw new Error('save-nothing')

        const runtimeBodyAtSave = resolveDocumentBodyForPath(pathToSave, contentSnapshotAtRequest)
        const diskMarkdown = diskMarkdownForDocumentSave(pathToSave, body)
        const projected = projectSavedMarkdownToEditorSurfaces('visual', diskMarkdown)
        if (pathsEqual(activePathRef.current, pathToSave)) {
          commitLatestDocumentBodyToMemory({
            path: pathToSave,
            body: projected.editorSurface,
            sourceIdentity: projected.sourceIdentity,
            contentRef,
            persistBody: persistEditorToTabStores,
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
        }

        await dispatchDocumentCommand({
          type: 'SAVE_DOCUMENT',
          root: QA_MULTI_TAB_ROOT,
          path: pathAtRequest,
          content: diskMarkdown,
          source: 'qa-save-production',
        })
        cancelPendingKernelContentDebounce()
      })
      return true
    } catch {
      return false
    }
  }, [
    cancelPendingKernelContentDebounce,
    persistEditorToTabStores,
    resolveDocumentBodyForPath,
  ])

  const savePath = useCallback(
    async (path: string): Promise<boolean> => {
      const pathAtRequest = path
      if (!pathAtRequest) return false
      if (pathsEqual(pathAtRequest, activePathRef.current)) {
        const flushed = await flushEditorToMemory()
        if (!flushed) return false
      }
      const contentSnapshot = pathsEqual(pathAtRequest, activePathRef.current)
        ? contentRef.current
        : undefined
      const tabBodySnapshot = resolveDocumentBody(pathAtRequest, { contentFallback: contentSnapshot })
      try {
        await enqueueSave(async () => {
          const body =
            resolveDocumentBody(pathAtRequest, { contentFallback: contentSnapshot }) ??
            tabBodySnapshot ??
            contentSnapshot
          if (body == null) throw new Error('save-nothing')
          const diskMarkdown = diskMarkdownForDocumentSave(pathAtRequest, body)
          await dispatchDocumentCommand({
            type: 'SAVE_DOCUMENT',
            root: QA_MULTI_TAB_ROOT,
            path: pathAtRequest,
            content: diskMarkdown,
            source: 'qa-save',
          })
        })
        return true
      } catch {
        return false
      }
    },
    [flushEditorToMemory],
  )

  const saveActive = useCallback(async () => {
    const path = activePathRef.current
    if (!path) return false
    return savePath(path)
  }, [savePath])

  const saveAllDirty = useCallback(async (): Promise<boolean> => {
    const flushed = await flushEditorToMemory()
    if (!flushed) return false
    const dirtyPaths = listDirtyDocumentPaths()
    for (const path of dirtyPaths) {
      const ok = await savePath(path)
      if (!ok) return false
    }
    return true
  }, [flushEditorToMemory, savePath])

  const rapidSwitch = useCallback(
    async (paths: string[], rounds: number) => {
      const blanks: string[] = []
      for (let round = 0; round < rounds; round += 1) {
        for (const path of paths) {
          await activateTab(path)
          await waitMs(40)
          const plain = editorPlainText()
          const expectedHeading = path.includes('doc-a')
            ? 'Doc A'
            : path.includes('doc-b')
              ? 'Doc B'
              : 'Doc C'
          const marker = qaMultiTabMarkerForPath(path)
          const markerOk = marker ? plain.includes('ORIGINAL') && plain.includes(expectedHeading) : plain.length > 0
          if (plain.length < 5 || !plain.includes(expectedHeading) || !markerOk) {
            blanks.push(`${path}@round${round}:${plain.slice(0, 80)}`)
          }
        }
      }
      return { blanks }
    },
    [activateTab, editorPlainText],
  )

  useEffect(() => {
    markAppSettingsHydratedForTests({ ...DEFAULT_APP_SETTINGS, language: 'en' })
  }, [])

  useEffect(() => {
    return subscribeDocumentRuntime(() => {
      bumpKernelRevision((value) => value + 1)
    })
  }, [])

  useEffect(() => {
    const handler = createRegistryShortcutHandler({
      executeManifestCommand: () => undefined,
      dispatchMenuAction: () => undefined,
      onSave: () => {
        void saveProduction()
      },
      onCloseWindow: () => undefined,
      onPreferences: () => undefined,
      onFocusMode: () => undefined,
      onModeToggle: () => undefined,
    })
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [saveProduction])

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      consoleErrorsRef.current.push(event.message)
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason)
      consoleErrorsRef.current.push(reason)
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  useEffect(() => {
    resetDocumentRuntimeKernel()
    clearTabBodies()
    diskStoreRef.current = { ...QA_MULTI_TAB_FIXTURES }
    consoleErrorsRef.current = []

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
        setOpenedTabs(Array.isArray(tabs) ? [...tabs] : tabs(openedTabsRef.current))
      },
      onDocumentOpened: () => undefined,
      onDocumentSaved: () => undefined,
      onOpenTabLimitReached: () => undefined,
    })

    const unsubBodies = installTabBodiesKernelSync()

    void (async () => {
      await dispatchDocumentCommand({
        type: 'RESTORE_WORKSPACE',
        root: QA_MULTI_TAB_ROOT,
        activePath: QA_MULTI_TAB_PATHS[0],
        openTabs: [...QA_MULTI_TAB_PATHS],
        source: 'qa-multi-tab-boot',
      })
      setOpenedTabs([...QA_MULTI_TAB_PATHS])
      setStatus('ready')
    })()

    return () => {
      unsubBodies()
      resetDocumentRuntimeKernel()
      clearTabBodies()
    }
  }, [])

  useEffect(() => {
    window.__QA_MULTI_TAB__ = {
      getActivePath: () => activePathRef.current,
      getTabOrder: () => [...openedTabsRef.current],
      getDiskContent: (path) => diskStoreRef.current[path] ?? null,
      getEditorPlainText: editorPlainText,
      isEditorBlank: () => editorPlainText().length === 0,
      getTabBody: (path) => getTabBody(path) ?? getTabBodyCacheSnapshot()[path],
      activateTab,
      editActive,
      saveActive,
      saveProduction,
      savePath,
      saveAllDirty,
      hasTabDirtyBadge: (tabFileName) =>
        Boolean(document.querySelector(`[data-testid="editor-tab:${tabFileName}"] .editor-tab-badge--dirty`)),
      isPathDirty: (path) => isPathDirty(path),
      probeCodeBlockSyncGap: () => {
        const pm = visualEditorRef.current?.getEditor()
        let pmText: string | null = null
        pm?.state.doc.descendants((node) => {
          if (node.type.name !== 'codeBlock' || pmText != null) return false
          pmText = node.textBetween(0, node.content.size, '\n', '\n')
          return false
        })
        const lines = document.querySelectorAll('.pm-code-block-cm .cm-line')
        const cmText =
          lines.length > 0
            ? Array.from(lines)
                .map((el) => el.textContent ?? '')
                .join('\n')
            : null
        const pendingCommit = cmText != null && pmText != null && cmText !== pmText
        return { cmText, pmText, pendingCommit }
      },
      rapidSwitch,
      resetDiskToFixtures: () => {
        diskStoreRef.current = { ...QA_MULTI_TAB_FIXTURES }
      },
    }
    return () => {
      delete window.__QA_MULTI_TAB__
    }
  }, [activateTab, editActive, editorPlainText, rapidSwitch, saveActive, saveAllDirty, savePath, saveProduction])

  const visualDocumentKey = `visual:${activePath || 'scratch'}:${coldOpenGeneration}`

  return (
    <div className="qa-multi-tab-shell" style={{ padding: 24, minHeight: '100vh', background: '#0f1115' }}>
      <h1 data-testid="qa-ready">Multi Tab QA</h1>
      <p data-testid="qa-status">{status}</p>
      <p data-testid="qa-active-path">{activePath}</p>

      <EditorTabBar
        t={t}
        openedTabs={openedTabs}
        activePath={activePath}
        externalDiskChangedPaths={new Set()}
        tabLabel={tabLabel}
        onActivate={(path) => {
          void activateTab(path)
        }}
        onClose={() => {}}
        onReorder={() => {}}
        onContextMenu={() => {}}
      />

      <div
        className="preview-pane markdown-visual-editor qa-multi-tab-editor"
        style={{ maxWidth: 980, minHeight: 320, marginTop: 16 }}
      >
        {activePath ? (
          <TiptapMarkdownEditor
            ref={visualEditorRef}
            documentKey={visualDocumentKey}
            markdown={content}
            activePath={activePath}
            rootDir={QA_MULTI_TAB_ROOT}
            sidebarListMode="outline"
            suppressMarkdownSyncRef={suppressMarkdownSerdeRef}
            onMarkdownChange={(next) => {
              contentRef.current = next
              setContent(next)
              const path = activePathRef.current
              if (!path) return
              persistEditorToTabStores(path, next)
              dispatchEditorContentToKernel(path, next, 'qa-editor-change')
            }}
            onActiveHeadingChange={() => {}}
            onSelectionActivity={() => {}}
            onStatus={() => {}}
            onOutlineHeadingsChange={() => {}}
            onPasteImage={async () => null}
            openReason={editorOpenReason}
          />
        ) : null}
      </div>
    </div>
  )
}

export function QaMultiTabPlayground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaMultiTabInner />
    </I18nProvider>
  )
}
