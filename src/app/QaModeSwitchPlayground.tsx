import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import type { Extension } from '@codemirror/state'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { I18nProvider, useI18n } from '../i18n'
import { getEnMessagesSnapshot, getLocaleMessagesSnapshot, getLocaleRawSnapshot } from '../i18n/localeRegistry'
import { comfortableEditorTheme, createWriterBaseExtensions } from './codemirror/sourceEditorExtensions'
import { createShowLineBreaksCompartmentExtension } from '../editor/cmShowLineBreaks'
import { EditorOpenReason } from '../editor/editorOpenReason'
import {
  TiptapMarkdownEditor,
  type AtomicVisualDocumentEnter,
  type TiptapMarkdownEditorHandle,
} from '../editor/TiptapMarkdownEditor'
import { SourceCodeMirrorPane } from '../editor/SourceCodeMirrorPane'
import { getSourceModeIdentity } from '../editor/sourceModeIdentity'
import {
  createInitialModeSwitchFsmState,
  modeSwitchFsmReducer,
  type ModeSwitchAnchorPayload,
} from '../editor/modeSwitchFSM'
import type { ModeSwitchPrepareResultKind } from '../editor/viewportModeAnchor'
import type { SourceModeEnterAnchor } from '../editor/viewportModeAnchor'
import type { SourceToVisualPrepareResult } from '../editor/modeSwitchTransitionPrepare'
import { useEditorModeSwitch } from './hooks/useEditorModeSwitch'
import { markAppSettingsHydratedForTests } from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'
import type { EditorView } from '@codemirror/view'

declare global {
  interface Window {
    __QA_MODE_SWITCH__?: {
      getPaneMode: () => 'visual' | 'source'
      getPendingSnapshot: () => boolean
      getSnapshotHeldInSource: () => boolean
      getLastReturnKind: () => ModeSwitchPrepareResultKind | null
      getMarkdown: () => string
      getSourceText: () => string
      countInVisual: (selector: string) => number
      hasConsoleErrors: () => boolean
      toggle: () => void
      switchToSource: () => void
      switchToVisual: () => void
      setSourceText: (text: string) => void
      runRoundTrip: () => Promise<{
        snapshotHeldInSource: boolean
        returnKind: ModeSwitchPrepareResultKind | null
        hadSnapshotOnReturn: boolean
      }>
    }
  }
}

const QA_DOCUMENT_KEY = 'qa:mode-switch'
const QA_MARKDOWN = `# Mode switch QA

Paragraph with **bold** and \`code\`.

\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`
`

const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function waitForPaneMode(
  readMode: () => 'visual' | 'source',
  expected: 'visual' | 'source',
  timeoutMs = 15000,
): Promise<void> {
  const start = Date.now()
  while (readMode() !== expected) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`timeout waiting for pane=${expected}, got=${readMode()}`)
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
  await waitMs(350)
}

function QaModeSwitchInner() {
  useEffect(() => {
    markAppSettingsHydratedForTests(DEFAULT_APP_SETTINGS)
  }, [])

  const { t } = useI18n()
  const [content, setContent] = useState(QA_MARKDOWN)
  const contentRef = useRef(content)
  contentRef.current = content
  const [mainPaneMode, setMainPaneModeState] = useState<'visual' | 'source'>('visual')
  const mainPaneModeRef = useRef(mainPaneMode)
  mainPaneModeRef.current = mainPaneMode
  const setMainPaneMode = useCallback((mode: 'visual' | 'source') => {
    mainPaneModeRef.current = mode
    setMainPaneModeState(mode)
  }, [])
  const [modeSwitchFsm, dispatchModeSwitchFsm] = useReducer(
    modeSwitchFsmReducer,
    undefined,
    () => createInitialModeSwitchFsmState('visual'),
  )
  const [atomicVisualDocumentEnter, setAtomicVisualDocumentEnter] = useState<AtomicVisualDocumentEnter | null>(null)
  const [editorOpenReason, setEditorOpenReason] = useState<EditorOpenReason>(EditorOpenReason.ColdOpen)
  const [sourceCodeMirrorInstanceKey, setSourceCodeMirrorInstanceKey] = useState(0)
  const [status, setStatus] = useState('booting')
  const consoleErrorsRef = useRef<string[]>([])

  const activePathRef = useRef(QA_DOCUMENT_KEY)
  const visualEditorRef = useRef<TiptapMarkdownEditorHandle | null>(null)
  const editorViewRef = useRef<EditorView | null>(null)
  const pendingSourceModeAnchorRef = useRef<SourceModeEnterAnchor | null>(null)
  const sourceCodeMirrorBootSelectionRef = useRef<{
    from: number
    to: number
    scrollTop?: number
    scrollRatio?: number
  } | null>(null)
  const suppressMarkdownSerdeRef = useRef(false)
  const modeToggleRetryCountRef = useRef(0)

  const qaMetricsRef = useRef({
    snapshotHeldInSource: false,
    lastReturnKind: null as ModeSwitchPrepareResultKind | null,
    hadSnapshotOnReturn: false,
  })

  const onModeSwitchAnchorPayload = useCallback((payload: ModeSwitchAnchorPayload | null) => {
    dispatchModeSwitchFsm({ type: 'ANCHOR_READY', pendingAnchor: payload })
  }, [])
  const onModeSwitchEnhancementFailed = useCallback(() => {
    setStatus('failed:enhancement')
  }, [])
  const onModeSwitchApplyingAnchor = useCallback(() => {
    dispatchModeSwitchFsm({ type: 'APPLYING_ANCHOR' })
  }, [])
  const logModeSwitchState = useCallback(() => {}, [])
  const onSourceToVisualPrepared = useCallback((prep: SourceToVisualPrepareResult) => {
    qaMetricsRef.current.lastReturnKind = prep.resultKind
    qaMetricsRef.current.hadSnapshotOnReturn = Boolean(prep.visualRestore?.modeSwitchSnapshot)
  }, [])

  const { dispatchModeToggle, handleSourceViewReady, switchToSourceMode, switchToVisualMode } =
    useEditorModeSwitch({
    mainPaneMode,
    modeSwitchFsm,
    activePath: QA_DOCUMENT_KEY,
    refs: {
      activePathRef,
      contentRef,
      visualEditorRef,
      editorViewRef,
      mainPaneModeRef,
      pendingSourceModeAnchorRef,
      sourceCodeMirrorBootSelectionRef,
      suppressMarkdownSerdeRef,
      modeToggleRetryCountRef,
    },
    setters: {
      setMainPaneMode,
      setAtomicVisualDocumentEnter,
      setSourceCodeMirrorInstanceKey,
      setEditorOpenReason,
      dispatchModeSwitchFsm,
    },
    onModeSwitchAnchorPayload,
    onModeSwitchEnhancementFailed,
    onModeSwitchApplyingAnchor,
    logModeSwitchState,
    onSourceToVisualPrepared,
  })

  const editorExtensions = useMemo((): Extension[] => {
    return [
      markdown({ codeLanguages: languages }),
      comfortableEditorTheme,
      ...createWriterBaseExtensions(t),
      createShowLineBreaksCompartmentExtension(),
    ]
  }, [t])

  const cmMountKey = useMemo(
    () => `cm:${QA_DOCUMENT_KEY}:${sourceCodeMirrorInstanceKey}`,
    [sourceCodeMirrorInstanceKey],
  )

  const noopAsync = useCallback(async () => null, [])
  const noop = useCallback(() => {}, [])

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      consoleErrorsRef.current.push(event.message)
    }
    window.addEventListener('error', onError)
    return () => window.removeEventListener('error', onError)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey
      if (!mod || event.key !== '/') return
      event.preventDefault()
      dispatchModeToggle()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dispatchModeToggle])

  useEffect(() => {
    window.__QA_MODE_SWITCH__ = {
      getPaneMode: () => mainPaneModeRef.current,
      getPendingSnapshot: () => Boolean(pendingSourceModeAnchorRef.current?.modeSwitchSnapshot),
      getSnapshotHeldInSource: () => qaMetricsRef.current.snapshotHeldInSource,
      getLastReturnKind: () => qaMetricsRef.current.lastReturnKind,
      getMarkdown: () => contentRef.current,
      getSourceText: () => editorViewRef.current?.state.doc.toString() ?? contentRef.current,
      countInVisual: (selector) =>
        document.querySelectorAll(`#editor-main-panel .tiptap-editor-content ${selector}`).length,
      hasConsoleErrors: () => consoleErrorsRef.current.length > 0,
      toggle: () => dispatchModeToggle(),
      switchToSource: () => {
        if (mainPaneModeRef.current !== 'source') void switchToSourceMode()
      },
      switchToVisual: () => {
        if (mainPaneModeRef.current !== 'visual') void switchToVisualMode()
      },
      setSourceText: (text) => {
        const view = editorViewRef.current
        if (view) {
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: text },
          })
        }
        setContent(text)
      },
      runRoundTrip: async () => {
        qaMetricsRef.current.lastReturnKind = null
        qaMetricsRef.current.hadSnapshotOnReturn = false
        qaMetricsRef.current.snapshotHeldInSource = false

        if (mainPaneModeRef.current !== 'visual') {
          switchToVisualMode()
          await waitForPaneMode(() => mainPaneModeRef.current, 'visual')
        }

        await switchToSourceMode()
        await waitForPaneMode(() => mainPaneModeRef.current, 'source')
        qaMetricsRef.current.snapshotHeldInSource = Boolean(
          pendingSourceModeAnchorRef.current?.modeSwitchSnapshot,
        )

        switchToVisualMode()
        await waitForPaneMode(() => mainPaneModeRef.current, 'visual')
        await waitMs(200)

        return {
          snapshotHeldInSource: qaMetricsRef.current.snapshotHeldInSource,
          returnKind: qaMetricsRef.current.lastReturnKind,
          hadSnapshotOnReturn: qaMetricsRef.current.hadSnapshotOnReturn,
        }
      },
    }
    setStatus('ready')
    return () => {
      delete window.__QA_MODE_SWITCH__
    }
  }, [dispatchModeToggle, setContent, switchToSourceMode, switchToVisualMode])

  const sourceDoc = getSourceModeIdentity(QA_DOCUMENT_KEY) ?? content

  return (
    <div style={{ padding: 24, background: '#0f1115', minHeight: '100vh' }}>
      <h1 data-testid="qa-ready" style={{ color: '#fff', marginBottom: 8 }}>
        Mode Switch QA
      </h1>
      <p data-testid="qa-status" style={{ color: '#cbd5e1', marginBottom: 16 }}>
        {status} pane={mainPaneMode}
      </p>
      <div
        id="editor-main-panel"
        data-pane-mode={mainPaneMode}
        data-testid="qa-editor-panel"
        className={mainPaneMode === 'source' ? 'markdown-source-view' : 'markdown-visual-editor'}
        style={{ height: 420, border: '1px solid #334155', borderRadius: 8, overflow: 'hidden' }}
      >
        {mainPaneMode === 'visual' ? (
          <TiptapMarkdownEditor
            ref={visualEditorRef}
            markdown={content}
            documentKey={QA_DOCUMENT_KEY}
            activePath={QA_DOCUMENT_KEY}
            rootDir=""
            sidebarListMode="files"
            onMarkdownChange={setContent}
            onActiveHeadingChange={noop}
            onStatus={noop}
            onPasteImage={noopAsync}
            atomicVisualDocumentEnter={atomicVisualDocumentEnter}
            onAtomicVisualDocumentEnterConsumed={() => setAtomicVisualDocumentEnter(null)}
            openReason={editorOpenReason}
            suppressMarkdownSyncRef={suppressMarkdownSerdeRef}
          />
        ) : (
          <SourceCodeMirrorPane
            mountKey={cmMountKey}
            doc={sourceDoc}
            openReason={editorOpenReason}
            restoreSelection={sourceCodeMirrorBootSelectionRef.current ?? undefined}
            extensions={editorExtensions}
            onChange={setContent}
            onViewReady={handleSourceViewReady}
            className="markdown-source-view"
            style={{ height: '100%' }}
          />
        )}
      </div>
    </div>
  )
}

export function QaModeSwitchPlayground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaModeSwitchInner />
    </I18nProvider>
  )
}
