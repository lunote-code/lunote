import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import '../App.css'
import { AboutDialog } from '../components/AboutDialog'
import { AlertDialog } from '../components/AlertDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { UnsavedChangesDialog } from '../components/UnsavedChangesDialog'
import { Icon } from '../design-system/icons/Icon'
import { AppCommandPaletteOverlay } from './components/AppCommandPaletteOverlay'
import { AppRenameDialog } from './components/AppRenameDialog'
import { EditorTabBar } from './components/EditorTabBar'
import type { RenameDialogState } from './workspace/types'
import type { PaletteCommandDef } from '../menu/menu.types'
import {
  applyBootEarlyThemeFromLocalStorage,
  applyBootEarlyThemeMarkup,
  resolveBootEarlyThemeMarkup,
} from '../platform/bootEarlyTheme'
import { applyInitialThemeFromSettings } from '../theme-runtime/themeRuntime'

const QA_TABS = ['/qa-vault/welcome.md', '/qa-vault/notes.md', '/qa-vault/readme.md'] as const

const UI_MESSAGES: Record<string, string> = {
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
  'app.commandPalette.aria': 'Command palette',
  'app.commandPalette.placeholder': 'Type a command…',
  'commandPalette.empty': 'No matching commands',
  'app.about.close': 'Close',
  'app.about.desc': 'A local Markdown notebook application for offline writing, editing, and document management.',
  'app.about.title': '{name} · Version {version}',
  'app.about.update.available': 'Version {version} is available',
  'app.about.update.checkFailed': 'Unable to check for updates right now.',
  'app.about.update.checking': 'Checking for updates…',
  'app.about.update.download': 'Download update',
  'app.about.update.latest': 'Up to date',
  'app.rename.cancel': 'Cancel',
  'app.rename.fileTitle': 'Rename file',
  'app.rename.hint': 'Enter a new name (include extension for files)',
  'app.rename.submit': 'Rename',
  'app.rename.submitting': 'Renaming…',
}

const PALETTE_COMMANDS: PaletteCommandDef[] = [
  {
    id: 'file.save',
    label: 'Save document',
    hint: 'Write changes to disk',
    keywords: ['save', 'write'],
    shortcut: 'Mod+S',
  },
  {
    id: 'view.toggleMode',
    label: 'Toggle source mode',
    hint: 'Switch between visual and Markdown source',
    keywords: ['source', 'visual', 'mode'],
    shortcut: 'Mod+/',
  },
  {
    id: 'preferences.open',
    label: 'Open preferences',
    hint: 'Appearance, editor, and language settings',
    keywords: ['settings', 'preferences'],
    shortcut: 'Mod+,',
  },
  {
    id: 'file.export',
    label: 'Export document',
    hint: 'HTML, PDF, Word, or PNG',
    keywords: ['export', 'pdf'],
  },
]

function t(key: string, vars?: Record<string, string | number>): string {
  let value = UI_MESSAGES[key] ?? key
  if (!vars) return value
  for (const [name, replacement] of Object.entries(vars)) {
    value = value.replace(`{${name}}`, String(replacement))
  }
  return value
}

declare global {
  interface Window {
    __QA_UI__?: {
      getActiveTab: () => string
      getTabOrder: () => string[]
      getLastCommandId: () => string | null
      getDialogAction: () => string | null
      getDialogCancelCount: () => number
      getPaletteIndex: () => number
      getThemeMode: () => 'light' | 'dark'
      openPalette: () => void
      closePalette: () => void
      filterPalette: (query: string) => void
      runHighlightedCommand: () => void
      setPaletteIndex: (index: number) => void
      openConfirm: () => void
      openUnsaved: () => void
      setTheme: (mode: 'light' | 'dark') => void
      sampleSurfaceColor: () => string
      getFocusedElementSummary: () => string
      setFocusMode: (on: boolean) => void
      isFocusMode: () => boolean
      probeFocusChrome: () => {
        layoutHasFocusClass: boolean
        sidebarVisible: boolean
        headerVisible: boolean
        tabBarVisible: boolean
        exitButtonVisible: boolean
        footerHasMinimalClass: boolean
        footerStatsVisible: boolean
      }
    }
  }
}

function QaUiInner() {
  const paletteInputRef = useRef<HTMLInputElement | null>(null)
  const [status, setStatus] = useState('ready')
  const [openedTabs, setOpenedTabs] = useState<string[]>([...QA_TABS])
  const [activePath, setActivePath] = useState<string>(QA_TABS[0])
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [paletteIndex, setPaletteIndex] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [unsavedOpen, setUnsavedOpen] = useState(false)
  const [alertOpen, setAlertOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [renameDialog, setRenameDialog] = useState<RenameDialogState | null>(null)
  const [renameInputValue, setRenameInputValue] = useState('note.md')
  const [renameError, setRenameError] = useState('')
  const [renameSubmitting, setRenameSubmitting] = useState(false)
  const renameInputRef = useRef<HTMLInputElement | null>(null)
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('dark')
  const [focusMode, setFocusModeState] = useState(false)
  const focusModeRef = useRef(false)
  const lastCommandRef = useRef<string | null>(null)
  const dialogActionRef = useRef<string | null>(null)
  const dialogCancelCountRef = useRef(0)
  const activePathRef = useRef(activePath)
  const openedTabsRef = useRef(openedTabs)

  activePathRef.current = activePath
  openedTabsRef.current = openedTabs
  focusModeRef.current = focusMode

  const setFocusMode = useCallback((on: boolean) => {
    focusModeRef.current = on
    setFocusModeState(on)
    setStatus(on ? 'focus:on' : 'focus:off')
  }, [])

  useEffect(() => {
    applyBootEarlyThemeFromLocalStorage()
    applyInitialThemeFromSettings()
    setThemeMode(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark')
  }, [])

  const paletteFiltered = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase()
    if (!q) return PALETTE_COMMANDS
    return PALETTE_COMMANDS.filter(
      (command) =>
        command.label.toLowerCase().includes(q) ||
        command.hint.toLowerCase().includes(q) ||
        command.keywords.some((keyword) => keyword.includes(q)),
    )
  }, [paletteQuery])

  const tabLabel = useCallback((path: string) => path.split('/').pop() ?? path, [])

  const setTheme = useCallback((mode: 'light' | 'dark') => {
    const variant = mode === 'light' ? 'github-light' : 'github-dark'
    applyBootEarlyThemeMarkup(resolveBootEarlyThemeMarkup(variant))
    applyInitialThemeFromSettings()
    setThemeMode(mode)
  }, [])

  useEffect(() => {
    if (!paletteOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPaletteOpen(false)
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setPaletteIndex((index) => Math.min(index + 1, Math.max(paletteFiltered.length - 1, 0)))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setPaletteIndex((index) => Math.max(index - 1, 0))
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        const command = paletteFiltered[paletteIndex]
        if (!command) return
        lastCommandRef.current = command.id
        setPaletteOpen(false)
        setStatus(`command:${command.id}`)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [paletteFiltered, paletteIndex, paletteOpen])

  useEffect(() => {
    window.__QA_UI__ = {
      getActiveTab: () => activePathRef.current,
      getTabOrder: () => [...openedTabsRef.current],
      getLastCommandId: () => lastCommandRef.current,
      getDialogAction: () => dialogActionRef.current,
      getDialogCancelCount: () => dialogCancelCountRef.current,
      getPaletteIndex: () => paletteIndex,
      getThemeMode: () => themeMode,
      openPalette: () => {
        setPaletteOpen(true)
        setPaletteQuery('')
        setPaletteIndex(0)
      },
      closePalette: () => setPaletteOpen(false),
      filterPalette: (query) => {
        setPaletteOpen(true)
        setPaletteQuery(query)
        setPaletteIndex(0)
      },
      runHighlightedCommand: () => {
        const command = paletteFiltered[paletteIndex]
        if (!command) return
        lastCommandRef.current = command.id
        setPaletteOpen(false)
        setStatus(`command:${command.id}`)
      },
      setPaletteIndex: (index) => setPaletteIndex(index),
      openConfirm: () => {
        dialogActionRef.current = null
        dialogCancelCountRef.current = 0
        setConfirmOpen(true)
      },
      openUnsaved: () => {
        dialogActionRef.current = null
        dialogCancelCountRef.current = 0
        setUnsavedOpen(true)
      },
      setTheme,
      sampleSurfaceColor: () => {
        const root = document.documentElement
        const rootBg = getComputedStyle(root).backgroundColor
        if (rootBg && rootBg !== 'rgba(0, 0, 0, 0)' && rootBg !== 'transparent') return rootBg
        const sample = document.querySelector('.qa-ui-surface-sample') as HTMLElement | null
        return sample ? getComputedStyle(sample).backgroundColor : rootBg
      },
      getFocusedElementSummary: () => {
        const el = document.activeElement
        if (!(el instanceof HTMLElement)) return 'none'
        const testId = el.getAttribute('data-testid')
        const aria = el.getAttribute('aria-label')
        const id = el.id
        const role = el.getAttribute('role')
        return [el.tagName.toLowerCase(), id && `#${id}`, role && `[${role}]`, testId && `@${testId}`, aria && `"${aria}"`]
          .filter(Boolean)
          .join(' ')
      },
      setFocusMode,
      isFocusMode: () => focusModeRef.current,
      probeFocusChrome: () => {
        const layout = document.querySelector('[data-testid="qa-focus-layout"]')
        const sidebar = document.querySelector('[data-testid="qa-focus-sidebar"]')
        const header = document.querySelector('[data-testid="qa-focus-header"]')
        const tabs = document.querySelector('[data-testid="qa-focus-tabs"]')
        const exitButton = document.querySelector('[data-testid="qa-focus-exit"]')
        const footer = document.querySelector('[data-testid="qa-focus-footer"]')
        const footerStats = footer?.querySelector('.editor-footer-stats')
        const isVisible = (el: Element | null | undefined) => {
          if (!(el instanceof HTMLElement)) return false
          const style = getComputedStyle(el)
          return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0
        }
        return {
          layoutHasFocusClass: layout?.classList.contains('focus-mode') ?? false,
          sidebarVisible: isVisible(sidebar),
          headerVisible: isVisible(header),
          tabBarVisible: isVisible(tabs),
          exitButtonVisible: isVisible(exitButton),
          footerHasMinimalClass: footer?.classList.contains('editor-footer--focus-minimal') ?? false,
          footerStatsVisible: isVisible(footerStats),
        }
      },
    }
    return () => {
      delete window.__QA_UI__
    }
  }, [focusMode, paletteFiltered, paletteIndex, setFocusMode, setTheme, themeMode])

  return (
    <div className="qa-ui-shell" style={{ padding: 24, minHeight: '100vh' }}>
      <h1 data-testid="qa-ready">UI QA</h1>
      <p data-testid="qa-status">{status}</p>
      <p data-testid="qa-theme-mode">{themeMode}</p>

      <div
        className="qa-ui-surface-sample app-chrome-panel"
        data-testid="qa-surface-sample"
        style={{ padding: 16, marginBottom: 16, borderRadius: 8, maxWidth: 720 }}
      >
        <p style={{ margin: 0 }}>Sample application surface for theme contrast checks.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" data-testid="open-palette" onClick={() => window.__QA_UI__?.openPalette()}>
          Open command palette
        </button>
        <button type="button" data-testid="open-confirm" onClick={() => window.__QA_UI__?.openConfirm()}>
          Open confirm dialog
        </button>
        <button type="button" data-testid="open-unsaved" onClick={() => window.__QA_UI__?.openUnsaved()}>
          Open unsaved dialog
        </button>
        <button type="button" data-testid="open-alert" onClick={() => setAlertOpen(true)}>
          Open alert dialog
        </button>
        <button type="button" data-testid="open-delete" onClick={() => setDeleteOpen(true)}>
          Open delete dialog
        </button>
        <button type="button" data-testid="open-about" onClick={() => setAboutOpen(true)}>
          Open about dialog
        </button>
        <button
          type="button"
          data-testid="open-rename"
          onClick={() => {
            setRenameError('')
            setRenameSubmitting(false)
            setRenameInputValue('note.md')
            setRenameDialog({
              root: '/qa-vault',
              oldPath: '/qa-vault/note.md',
              isDirectory: false,
              mode: 'rename',
              parentPath: '/qa-vault',
            })
          }}
        >
          Open rename dialog
        </button>
        <button type="button" data-testid="set-theme-light" onClick={() => setTheme('light')}>
          Light theme
        </button>
        <button type="button" data-testid="set-theme-dark" onClick={() => setTheme('dark')}>
          Dark theme
        </button>
        <button type="button" data-testid="enter-focus" onClick={() => setFocusMode(true)}>
          Enter focus mode
        </button>
      </div>

      <div
        data-testid="qa-focus-layout"
        className={`qa-focus-layout layout workspace-split mod-root ${
          focusMode ? 'focus-mode without-sidebar' : 'with-sidebar'
        }`}
        style={{ marginBottom: 16, minHeight: 260, border: '1px solid var(--border-subtle, #333)' }}
      >
        {!focusMode ? (
          <aside
            data-testid="qa-focus-sidebar"
            className="sidebar"
            style={{ width: 180, padding: 12, background: 'var(--surface-panel, #1a1d24)' }}
          >
            Workspace sidebar
          </aside>
        ) : null}
        <main
          className="main main-with-rail workspace-leaf mod-active"
          style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 240 }}
        >
          {!focusMode ? (
            <header data-testid="qa-focus-header" className="editor-header view-header" style={{ padding: '8px 12px' }}>
              <span className="editor-document-title">Focus QA document</span>
            </header>
          ) : null}
          {!focusMode ? (
            <div data-testid="qa-focus-tabs" className="editor-tab-bar-shell" style={{ padding: '4px 8px' }}>
              <span>welcome.md</span>
              <span>notes.md</span>
            </div>
          ) : null}
          {focusMode ? (
            <div className="focus-mode-actions">
              <button
                type="button"
                data-testid="qa-focus-exit"
                className="focus-exit-btn"
                onClick={() => setFocusMode(false)}
              >
                Exit focus
              </button>
            </div>
          ) : null}
          <div className="editor-pane" data-testid="qa-focus-editor-pane" style={{ padding: 12, flex: 1 }}>
            Editor pane
          </div>
          <div
            className="preview-pane markdown-visual-editor"
            data-testid="qa-focus-preview"
            style={{ padding: 12, minHeight: 48 }}
          >
            Document surface
          </div>
          <footer
            data-testid="qa-focus-footer"
            className={`editor-footer${focusMode ? ' editor-footer--focus-minimal' : ''}`}
            style={{ padding: '4px 12px' }}
          >
            <span className="editor-footer-stats">120 words</span>
            <span className="editor-footer-message">Ready</span>
          </footer>
        </main>
      </div>

      <EditorTabBar
        t={t}
        openedTabs={openedTabs}
        activePath={activePath}
        externalDiskChangedPaths={new Set()}
        tabLabel={tabLabel}
        onActivate={(path) => {
          setActivePath(path)
          setStatus(`tab:${path}`)
        }}
        onClose={(path) => {
          setOpenedTabs((tabs) => tabs.filter((item) => item !== path))
          if (activePath === path) {
            const next = openedTabs.find((item) => item !== path) ?? ''
            setActivePath(next)
          }
          setStatus(`closed:${path}`)
        }}
        onReorder={(fromIndex, toIndex) => {
          setOpenedTabs((tabs) => {
            const next = [...tabs]
            const [moved] = next.splice(fromIndex, 1)
            next.splice(toIndex, 0, moved!)
            return next
          })
          setStatus(`reordered:${fromIndex}->${toIndex}`)
        }}
        onContextMenu={() => {}}
        trailingActions={
          <>
            <button
              type="button"
              className="luna-chrome-icon-btn editor-chrome-action-btn"
              data-testid="editor-focus-toggle"
              aria-label="Focus mode"
            >
              <Icon name="focus" size="sm" stroke="strong" />
            </button>
            <button
              type="button"
              className="luna-chrome-icon-btn editor-chrome-action-btn"
              data-testid="editor-knowledge-toggle"
              aria-label="Knowledge panel"
            >
              <Icon name="graph" size="sm" stroke="strong" />
            </button>
          </>
        }
      />

      <AppCommandPaletteOverlay
        t={t}
        open={paletteOpen}
        query={paletteQuery}
        index={paletteIndex}
        inputRef={paletteInputRef}
        paletteFiltered={paletteFiltered}
        onClose={() => setPaletteOpen(false)}
        onQueryChange={setPaletteQuery}
        onIndexChange={setPaletteIndex}
        onRunCommand={(id) => {
          lastCommandRef.current = id
          setPaletteOpen(false)
          setStatus(`command:${id}`)
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Delete workspace folder?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={() => {
          dialogActionRef.current = 'confirm'
          setConfirmOpen(false)
          setStatus('dialog:confirm')
        }}
        onCancel={() => {
          dialogActionRef.current = 'cancel'
          dialogCancelCountRef.current += 1
          setConfirmOpen(false)
          setStatus('dialog:cancel')
        }}
      />

      <UnsavedChangesDialog
        open={unsavedOpen}
        title="Unsaved changes"
        message="Save your changes before closing?"
        saveLabel="Save all"
        discardLabel="Discard"
        cancelLabel="Cancel"
        onSave={() => {
          dialogActionRef.current = 'save'
          setUnsavedOpen(false)
          setStatus('dialog:save')
        }}
        onDiscard={() => {
          dialogActionRef.current = 'discard'
          setUnsavedOpen(false)
          setStatus('dialog:discard')
        }}
        onCancel={() => {
          dialogActionRef.current = 'cancel'
          dialogCancelCountRef.current += 1
          setUnsavedOpen(false)
          setStatus('dialog:cancel')
        }}
      />

      <AlertDialog
        open={alertOpen}
        title="Export failed"
        message="The document could not be exported."
        okLabel="OK"
        onClose={() => {
          setAlertOpen(false)
          setStatus('dialog:alert-ok')
        }}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        title="Delete note?"
        message="This file will be moved to the trash."
        fileLabel="note.md"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => {
          setDeleteOpen(false)
          setStatus('dialog:delete-confirm')
        }}
        onCancel={() => {
          setDeleteOpen(false)
          setStatus('dialog:delete-cancel')
        }}
      />

      {aboutOpen ? <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} t={t} /> : null}

      <AppRenameDialog
        t={t}
        renameDialog={renameDialog}
        renameInputValue={renameInputValue}
        renameError={renameError}
        renameSubmitting={renameSubmitting}
        renameInputRef={renameInputRef}
        onRenameInputChange={setRenameInputValue}
        onRenameSubmit={async () => {
          setRenameSubmitting(true)
          setRenameError('')
          await new Promise((resolve) => window.setTimeout(resolve, 0))
          setRenameSubmitting(false)
          setRenameDialog(null)
          setStatus('dialog:rename-submit')
        }}
        onRenameClose={() => {
          setRenameDialog(null)
          setStatus('dialog:rename-cancel')
        }}
        onRenameTemplateChange={() => {}}
      />
    </div>
  )
}

export function QaUiPlayground() {
  return <QaUiInner />
}
