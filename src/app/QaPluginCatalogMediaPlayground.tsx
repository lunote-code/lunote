import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import '../App.css'
import { I18nProvider, useI18n } from '../i18n'
import {
  getEnMessagesSnapshot,
  getLocaleMessagesSnapshot,
  getLocaleRawSnapshot,
} from '../i18n/localeRegistry'
import { EditorTabBar } from './components/EditorTabBar'
import { AppSidebarPanel } from './components/AppSidebarPanel'
import {
  TiptapMarkdownEditor,
  type TiptapMarkdownEditorHandle,
} from '../editor/TiptapMarkdownEditor'
import { EditorOpenReason } from '../editor/editorOpenReason'
import { markAppSettingsHydratedForTests } from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'
import {
  applyBootEarlyThemeMarkup,
  resolveBootEarlyThemeMarkup,
} from '../platform/bootEarlyTheme'
import {
  applyInitialThemeFromSettings,
  registerImportedCustomTheme,
} from '../theme-runtime/themeRuntime'
import { loadThemeFromJSON } from '../theme-runtime/themeLoader'
import { refreshThemeStylesheetFromSettings } from '../theme-runtime/themeStylesheetRuntime'
import {
  refreshThemeSnippetsFromSettings,
  stringifySnippetNames,
} from '../theme-runtime/themeSnippetRuntime'
import { subscribeThemeRuntime } from '../theme-runtime/themeRuntime'
import type { FileSortMode, FlatWorkspaceFile, FsTreeNode } from './workspace/types'

const QA_ROOT = '/qa-plugin-media-vault'
const QA_DOC = `${QA_ROOT}/theme-preview.md`

const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

const SAMPLE_MARKDOWN = `# Theme preview

Long-form writing with **bold**, *italic*, and \`inline code\` for catalog screenshots.

## Secondary heading

Wiki-style links like [[Project notes]] and [external links](https://example.com).

> A calm blockquote for reading-focused themes.

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}\`
}
\`\`\`

- Capture list spacing and selection tint
- Compare link and code block contrast
`

const SIDEBAR_TREE: FsTreeNode[] = [
  { name: 'theme-preview.md', path: QA_DOC, kind: 'file', children: [] },
  {
    name: 'projects',
    path: `${QA_ROOT}/projects`,
    kind: 'dir',
    children: [
      { name: 'alpha-roadmap.md', path: `${QA_ROOT}/projects/alpha-roadmap.md`, kind: 'file', children: [] },
      { name: 'beta-notes.md', path: `${QA_ROOT}/projects/beta-notes.md`, kind: 'file', children: [] },
      { name: 'release-checklist.md', path: `${QA_ROOT}/projects/release-checklist.md`, kind: 'file', children: [] },
    ],
  },
  {
    name: 'research',
    path: `${QA_ROOT}/research`,
    kind: 'dir',
    children: [
      { name: 'literature-review.md', path: `${QA_ROOT}/research/literature-review.md`, kind: 'file', children: [] },
      { name: 'meeting-log.md', path: `${QA_ROOT}/research/meeting-log.md`, kind: 'file', children: [] },
      { name: 'open-questions.md', path: `${QA_ROOT}/research/open-questions.md`, kind: 'file', children: [] },
      { name: 'sources.md', path: `${QA_ROOT}/research/sources.md`, kind: 'file', children: [] },
    ],
  },
  {
    name: 'archive',
    path: `${QA_ROOT}/archive`,
    kind: 'dir',
    children: [
      { name: '2024-retro.md', path: `${QA_ROOT}/archive/2024-retro.md`, kind: 'file', children: [] },
      { name: 'draft-ideas.md', path: `${QA_ROOT}/archive/draft-ideas.md`, kind: 'file', children: [] },
      { name: 'weekly-01.md', path: `${QA_ROOT}/archive/weekly-01.md`, kind: 'file', children: [] },
      { name: 'weekly-02.md', path: `${QA_ROOT}/archive/weekly-02.md`, kind: 'file', children: [] },
      { name: 'weekly-03.md', path: `${QA_ROOT}/archive/weekly-03.md`, kind: 'file', children: [] },
    ],
  },
]

export type PluginMediaPackConfig = {
  themeActive?: string
  customThemeJSON?: string
  externalCss?: string
  externalCssFile?: string
  snippets?: Record<string, string>
  enabledSnippets?: string[]
}

declare global {
  interface Window {
    __QA_PLUGIN_CATALOG_MEDIA__?: {
      getStatus: () => 'booting' | 'ready'
      applyPack: (config: PluginMediaPackConfig) => Promise<void>
      resetPack: () => Promise<void>
    }
  }
}

function flattenWorkspaceFiles(nodes: FsTreeNode[], rootDir: string): FlatWorkspaceFile[] {
  const out: FlatWorkspaceFile[] = []
  const walk = (items: FsTreeNode[]) => {
    for (const node of items) {
      if (node.kind === 'file') {
        const relativePath =
          rootDir && node.path.startsWith(`${rootDir}/`)
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

function QaPluginCatalogMediaInner() {
  const { t } = useI18n()
  const editorRef = useRef<TiptapMarkdownEditorHandle>(null)
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null)
  const workspaceMenuPopRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<'booting' | 'ready'>('booting')
  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN)
  const [openedTabs, setOpenedTabs] = useState<string[]>([QA_DOC])
  const [activePath, setActivePath] = useState(QA_DOC)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(
    () => new Set([`${QA_ROOT}/projects`, `${QA_ROOT}/research`, `${QA_ROOT}/archive`]),
  )
  const [sidebarListMode, setSidebarListMode] = useState<'files' | 'outline'>('files')
  const [sidebarFileView, setSidebarFileView] = useState<'tree' | 'list'>('tree')
  const [fileSortMode, setFileSortMode] = useState<FileSortMode>('group')
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)

  const flatFiles = useMemo(() => flattenWorkspaceFiles(SIDEBAR_TREE, QA_ROOT), [])
  const tabLabel = useCallback((path: string) => path.split('/').pop() ?? path, [])

  const workspaceMenuPopStyle: CSSProperties | null = workspaceMenuOpen
    ? {
        position: 'fixed',
        left: 180,
        top: 48,
        visibility: 'visible',
      }
    : null

  const applyPack = useCallback(async (config: PluginMediaPackConfig) => {
    const themeActive = config.themeActive?.trim() || 'github-dark'
    const externalCssFile = config.externalCssFile?.trim() || 'plugin-pack.css'
    const enabledSnippets = config.enabledSnippets ?? []
    const inlineMap = config.snippets ?? {}

    markAppSettingsHydratedForTests({
      ...DEFAULT_APP_SETTINGS,
      language: 'en',
      appearance: {
        ...DEFAULT_APP_SETTINGS.appearance,
        theme: {
          ...DEFAULT_APP_SETTINGS.appearance?.theme,
          active: themeActive,
          cssFile: config.externalCss?.trim() ? externalCssFile : '',
          cssContent: config.externalCss?.trim() ?? '',
          cssSnippets: stringifySnippetNames(enabledSnippets),
          cssSnippetsInline: JSON.stringify(inlineMap),
          customThemeJSON: config.customThemeJSON?.trim() ?? '',
          customThemeFile: '',
        },
      },
    })

    if (config.customThemeJSON?.trim()) {
      const theme = loadThemeFromJSON(config.customThemeJSON)
      registerImportedCustomTheme(theme)
    }

    applyBootEarlyThemeMarkup(resolveBootEarlyThemeMarkup(themeActive))
    applyInitialThemeFromSettings()
    await refreshThemeStylesheetFromSettings()
    await refreshThemeSnippetsFromSettings()
  }, [])

  const resetPack = useCallback(async () => {
    await applyPack({ themeActive: 'github-dark' })
  }, [applyPack])

  useEffect(() => subscribeThemeRuntime(), [])

  useEffect(() => {
    void (async () => {
      await applyPack({ themeActive: 'github-dark' })
      setStatus('ready')
    })()
  }, [applyPack])

  useEffect(() => {
    window.__QA_PLUGIN_CATALOG_MEDIA__ = {
      getStatus: () => status,
      applyPack,
      resetPack,
    }
    return () => {
      delete window.__QA_PLUGIN_CATALOG_MEDIA__
    }
  }, [applyPack, resetPack, status])

  return (
    <div className="qa-plugin-catalog-media-root">
      <div className="qa-plugin-catalog-media-hidden" aria-hidden="true" style={{ position: 'fixed', left: -9999, top: 0 }}>
        <p data-testid="qa-ready">Plugin catalog media QA</p>
        <p data-testid="qa-status">{status}</p>
      </div>

      <div
        data-testid="plugin-media-capture-frame"
        className="layout workspace-split mod-root qa-plugin-catalog-media-frame with-sidebar"
        style={{ width: 1280, height: 800, overflow: 'hidden' }}
      >
        <AppSidebarPanel
          t={t}
          rootDir={QA_ROOT}
          activePath={activePath}
          searchText=""
          setSearchText={() => undefined}
          isSidebarFiltering={false}
          sidebarFilterMatchCount={flatFiles.length}
          sidebarListMode={sidebarListMode}
          draggingWorkspaceFile={null}
          dragOverTarget={null}
          setDragOverTarget={() => undefined}
          onSidebarBlankContextMenu={() => undefined}
          onSidebarFileContextMenu={() => undefined}
          outlineHeadings={[]}
          activeOutlineId={null}
          scrollPreviewToHeading={() => undefined}
          fileTree={SIDEBAR_TREE}
          sidebarFileView={sidebarFileView}
          setSidebarFileView={setSidebarFileView}
          workspaceFolderNodes={SIDEBAR_TREE}
          sortedFlatWorkspaceFiles={flatFiles}
          sortedFileTree={SIDEBAR_TREE}
          expandedDirs={expandedDirs}
          toggleWorkspaceDir={(path) => {
            setExpandedDirs((prev) => {
              const next = new Set(prev)
              if (next.has(path)) next.delete(path)
              else next.add(path)
              return next
            })
          }}
          isFilePathSelected={(path) => path === activePath}
          onWorkspaceFileClick={(_event, path) => setActivePath(path)}
          onWorkspaceFilePointerDown={() => undefined}
          handleMoveFileToFolder={() => undefined}
          createNewNote={() => undefined}
          createNewNoteFromTemplate={() => undefined}
          workspaceFolderName="Plugin Media Vault"
          workspaceMenuRef={workspaceMenuRef}
          workspaceMenuPopRef={workspaceMenuPopRef}
          workspaceMenuOpen={workspaceMenuOpen}
          setWorkspaceMenuOpen={setWorkspaceMenuOpen}
          workspaceMenuPopStyle={workspaceMenuPopStyle}
          fileSortMode={fileSortMode}
          setFileSortMode={setFileSortMode}
          setSidebarListMode={setSidebarListMode}
          setStatus={() => undefined}
          chooseFolder={() => undefined}
          refreshFileTree={async () => undefined}
          recentFiles={[]}
          onOpenRecent={() => undefined}
          onClearRecent={async () => undefined}
          sidebarStatusLine=""
        />

        <main className="main main-with-rail workspace-leaf mod-active" data-testid="plugin-media-editor-pane">
          <EditorTabBar
            t={t}
            openedTabs={openedTabs}
            activePath={activePath}
            externalDiskChangedPaths={new Set()}
            tabLabel={tabLabel}
            onActivate={setActivePath}
            onClose={(path) => {
              setOpenedTabs((tabs) => tabs.filter((entry) => entry !== path))
              if (activePath === path) {
                setActivePath(openedTabs.find((entry) => entry !== path) ?? '')
              }
            }}
            onReorder={() => undefined}
            onContextMenu={() => undefined}
          />
          <div className="editor-body-surface view-content preview-pane markdown-visual-editor" data-testid="plugin-media-editor-surface">
            <TiptapMarkdownEditor
              ref={editorRef}
              documentKey={`${QA_DOC}:media`}
              markdown={markdown}
              activePath={QA_DOC}
              rootDir={QA_ROOT}
              sidebarListMode={sidebarListMode}
              onMarkdownChange={setMarkdown}
              onActiveHeadingChange={() => undefined}
              onStatus={() => undefined}
              onPasteImage={async () => null}
              openReason={EditorOpenReason.ColdOpen}
            />
          </div>
        </main>
      </div>
    </div>
  )
}

export function QaPluginCatalogMediaPlayground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaPluginCatalogMediaInner />
    </I18nProvider>
  )
}
