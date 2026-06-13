import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import '../App.css'
import { I18nProvider, useI18n } from '../i18n'
import {
  getEnMessagesSnapshot,
  getLocaleMessagesSnapshot,
  getLocaleRawSnapshot,
} from '../i18n/localeRegistry'
import { EmptyState } from '../design-system/EmptyState'
import { EditorTabBar } from './components/EditorTabBar'
import { AppSidebarPanel } from './components/AppSidebarPanel'
import { createRegistryShortcutHandler } from '../menu/shortcutRuntime'
import { markAppSettingsHydratedForTests } from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'
import type { FileSortMode, FlatWorkspaceFile, FsTreeNode } from './workspace/types'

const QA_ROOT = '/qa-first-run-vault'
const QA_WELCOME = `${QA_ROOT}/welcome.md`
const QA_NOTES = `${QA_ROOT}/notes/ideas.md`

const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

const INITIAL_TREE: FsTreeNode[] = [
  {
    name: 'welcome.md',
    path: QA_WELCOME,
    kind: 'file',
    children: [],
  },
  {
    name: 'notes',
    path: `${QA_ROOT}/notes`,
    kind: 'dir',
    children: [
      {
        name: 'ideas.md',
        path: QA_NOTES,
        kind: 'file',
        children: [],
      },
    ],
  },
]

export type QaFirstRunPhase = 'no-workspace' | 'workspace-open' | 'note-created'

declare global {
  interface Window {
    __QA_FIRST_RUN__?: {
      getPhase: () => QaFirstRunPhase
      getWorkspaceRoot: () => string
      getActivePath: () => string
      getOpenTabs: () => string[]
      isSidebarVisible: () => boolean
      openFolder: () => void
      createNewNote: () => void
      toggleSidebar: () => void
      getConsoleErrors: () => string[]
    }
  }
}

function flattenWorkspaceFiles(nodes: FsTreeNode[], rootDir: string): FlatWorkspaceFile[] {
  const out: FlatWorkspaceFile[] = []
  const walk = (items: FsTreeNode[]) => {
    for (const node of items) {
      if (node.kind === 'file') {
        const relativePath = rootDir && node.path.startsWith(`${rootDir}/`)
          ? node.path.slice(rootDir.length + 1)
          : node.name
        out.push({
          path: node.path,
          label: node.name,
          relativePath,
          modifiedAtMs: node.modifiedAtMs,
          createdAtMs: node.createdAtMs,
        })
      }
      if (node.children.length > 0) walk(node.children)
    }
  }
  walk(nodes)
  return out
}

function QaFirstRunInner() {
  const { t } = useI18n()
  const [phase, setPhase] = useState<QaFirstRunPhase>('no-workspace')
  const [rootDir, setRootDir] = useState('')
  const [fileTree, setFileTree] = useState<FsTreeNode[]>([])
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set())
  const [openedTabs, setOpenedTabs] = useState<string[]>([])
  const [activePath, setActivePath] = useState('')
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [sidebarListMode, setSidebarListMode] = useState<'files' | 'outline'>('files')
  const [sidebarFileView, setSidebarFileView] = useState<'tree' | 'list'>('tree')
  const [fileSortMode, setFileSortMode] = useState<FileSortMode>('group')
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [status, setStatus] = useState('ready')

  const phaseRef = useRef(phase)
  const rootDirRef = useRef(rootDir)
  const activePathRef = useRef(activePath)
  const openedTabsRef = useRef(openedTabs)
  const sidebarVisibleRef = useRef(sidebarVisible)
  const consoleErrorsRef = useRef<string[]>([])
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null)
  const workspaceMenuPopRef = useRef<HTMLDivElement | null>(null)

  phaseRef.current = phase
  rootDirRef.current = rootDir
  activePathRef.current = activePath
  openedTabsRef.current = openedTabs
  sidebarVisibleRef.current = sidebarVisible

  const workspaceFolderName = rootDir ? 'qa-first-run-vault' : t('app.titleBar.noFolder')
  const flatFiles = useMemo(() => flattenWorkspaceFiles(fileTree, rootDir), [fileTree, rootDir])

  const openFolder = useCallback(() => {
    setRootDir(QA_ROOT)
    setFileTree(INITIAL_TREE)
    setExpandedDirs(new Set([`${QA_ROOT}/notes`]))
    setOpenedTabs([])
    setActivePath('')
    setPhase('workspace-open')
    setStatus('folder-opened')
  }, [])

  const createNewNote = useCallback(() => {
    if (!rootDirRef.current) {
      const scratchId = 'buffer:scratch-qa'
      setOpenedTabs([scratchId])
      setActivePath(scratchId)
      setPhase('note-created')
      setStatus('scratch-created')
      return
    }
    const nextPath = `${QA_ROOT}/untitled-note.md`
    setFileTree((tree) => {
      if (tree.some((node) => node.path === nextPath)) return tree
      return [
        ...tree,
        {
          name: 'untitled-note.md',
          path: nextPath,
          kind: 'file',
          children: [],
        },
      ]
    })
    setOpenedTabs([nextPath])
    setActivePath(nextPath)
    setPhase('note-created')
    setStatus('note-created')
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarVisible((visible) => !visible)
    setStatus('toggle-sidebar')
  }, [])

  useEffect(() => {
    markAppSettingsHydratedForTests({ ...DEFAULT_APP_SETTINGS, language: 'en' })
  }, [])

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      consoleErrorsRef.current.push(event.message)
    }
    window.addEventListener('error', onError)
    return () => window.removeEventListener('error', onError)
  }, [])

  useEffect(() => {
    const handler = createRegistryShortcutHandler({
      executeManifestCommand: (commandId) => {
        if (commandId === 'toggle-sidebar') toggleSidebar()
      },
      dispatchMenuAction: () => undefined,
      onSave: () => undefined,
      onCloseWindow: () => undefined,
      onPreferences: () => undefined,
      onFocusMode: () => undefined,
      onModeToggle: () => undefined,
    })
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [toggleSidebar])

  useEffect(() => {
    window.__QA_FIRST_RUN__ = {
      getPhase: () => phaseRef.current,
      getWorkspaceRoot: () => rootDirRef.current,
      getActivePath: () => activePathRef.current,
      getOpenTabs: () => [...openedTabsRef.current],
      isSidebarVisible: () => sidebarVisibleRef.current,
      openFolder,
      createNewNote,
      toggleSidebar,
      getConsoleErrors: () => [...consoleErrorsRef.current],
    }
    return () => {
      delete window.__QA_FIRST_RUN__
    }
  }, [createNewNote, openFolder, toggleSidebar])

  const workspaceMenuPopStyle: CSSProperties | null = workspaceMenuOpen
    ? {
        position: 'fixed',
        left: 180,
        top: 48,
        visibility: 'visible',
      }
    : null

  const tabLabel = useCallback((path: string) => path.split('/').pop() ?? path, [])

  return (
    <div className="qa-first-run-root">
      <div className="qa-first-run-diagnostics">
        <p data-testid="qa-ready">First run QA</p>
        <p data-testid="qa-status">{status}</p>
        <p data-testid="qa-phase">{phase}</p>
        <p data-testid="qa-workspace-root">{rootDir}</p>
        <p data-testid="qa-active-path">{activePath}</p>
        <p data-testid="qa-open-tabs">{openedTabs.join('|')}</p>
        <p data-testid="qa-sidebar-visible">{sidebarVisible ? 'yes' : 'no'}</p>
      </div>

      <div
        data-testid="qa-first-run-layout"
        className={`layout workspace-split mod-root qa-first-run-layout ${sidebarVisible ? 'with-sidebar' : 'without-sidebar'}`}
      >
        {sidebarVisible ? (
          <AppSidebarPanel
            t={t}
            rootDir={rootDir}
            activePath={activePath}
            searchText={searchText}
            setSearchText={setSearchText}
            isSidebarFiltering={Boolean(searchText.trim())}
            sidebarFilterMatchCount={flatFiles.length}
            sidebarListMode={sidebarListMode}
            draggingWorkspaceFile={null}
            dragOverTarget={null}
            setDragOverTarget={() => undefined}
            onSidebarBlankContextMenu={() => undefined}
            dispatchOpenDocument={() => undefined}
            onSidebarFileContextMenu={() => undefined}
            outlineHeadings={[]}
            activeOutlineId={null}
            scrollPreviewToHeading={() => undefined}
            fileTree={fileTree}
            sidebarFileView={sidebarFileView}
            setSidebarFileView={setSidebarFileView}
            workspaceFolderNodes={fileTree}
            sortedFlatWorkspaceFiles={flatFiles}
            sortedFileTree={fileTree}
            expandedDirs={expandedDirs}
            toggleWorkspaceDir={(path) => {
              setExpandedDirs((prev) => {
                const next = new Set(prev)
                if (next.has(path)) next.delete(path)
                else next.add(path)
                return next
              })
            }}
            isFilePathSelected={() => false}
            onWorkspaceFileClick={() => undefined}
            onWorkspaceFilePointerDown={() => undefined}
            handleMoveFileToFolder={() => undefined}
            createNewNote={createNewNote}
            createNewNoteFromTemplate={createNewNote}
            workspaceFolderName={workspaceFolderName}
            workspaceMenuRef={workspaceMenuRef}
            workspaceMenuPopRef={workspaceMenuPopRef}
            workspaceMenuOpen={workspaceMenuOpen}
            setWorkspaceMenuOpen={setWorkspaceMenuOpen}
            workspaceMenuPopStyle={workspaceMenuPopStyle}
            fileSortMode={fileSortMode}
            setFileSortMode={setFileSortMode}
            setSidebarListMode={setSidebarListMode}
            setStatus={setStatus}
            chooseFolder={openFolder}
            refreshFileTree={async () => setStatus('refreshed')}
            recentFiles={[]}
            onOpenRecent={() => undefined}
            onClearRecent={async () => undefined}
            sidebarStatusLine=""
          />
        ) : null}

        <main className="main main-with-rail workspace-leaf mod-active" data-testid="qa-first-run-main">
          <EditorTabBar
            t={t}
            openedTabs={openedTabs}
            activePath={activePath}
            externalDiskChangedPaths={new Set()}
            tabLabel={tabLabel}
            onActivate={setActivePath}
            onClose={(path) => {
              setOpenedTabs((tabs) => tabs.filter((item) => item !== path))
              if (activePath === path) {
                setActivePath(openedTabs.find((item) => item !== path) ?? '')
              }
            }}
            onReorder={() => undefined}
            onContextMenu={() => undefined}
          />

          <div className="editor-body-surface view-content" data-testid="qa-editor-surface">
            {activePath ? (
              <div
                className="preview-pane markdown-visual-editor"
                data-testid="qa-first-run-editor-pane"
              >
                <p className="qa-first-run-editor-stub">Editing {tabLabel(activePath)}</p>
              </div>
            ) : (
              <EmptyState
                variant="page"
                icon={rootDir ? 'note' : 'workspace-open'}
                title={rootDir ? t('app.editor.empty.noNoteTitle') : t('app.sidebar.empty.title')}
                actions={
                  rootDir ? (
                    <button type="button" className="focus-exit-btn" onClick={() => void createNewNote()}>
                      {t('app.sidebar.newNoteWithRoot')}
                    </button>
                  ) : (
                    <>
                      <button type="button" className="focus-exit-btn" onClick={() => void openFolder()}>
                        {t('app.sidebar.empty.openFolderCta')}
                      </button>
                      <button type="button" className="luna-empty-state-btn-secondary" onClick={() => void createNewNote()}>
                        {t('app.sidebar.empty.scratchCta')}
                      </button>
                    </>
                  )
                }
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export function QaFirstRunPlayground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaFirstRunInner />
    </I18nProvider>
  )
}
