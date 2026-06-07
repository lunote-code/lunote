import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ConfirmDialog } from '../components/ConfirmDialog'
import { UnsavedChangesDialog } from '../components/UnsavedChangesDialog'
import { AppCommandPaletteOverlay } from './components/AppCommandPaletteOverlay'
import { EditorTabBar } from './components/EditorTabBar'
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

function t(key: string): string {
  return UI_MESSAGES[key] ?? key
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
          return el.offsetParent !== null || getComputedStyle(el).display !== 'none'
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
    </div>
  )
}

export function QaUiPlayground() {
  return <QaUiInner />
}
