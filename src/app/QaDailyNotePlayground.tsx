import { useCallback, useEffect, useRef, useState } from 'react'

import '../App.css'
import { I18nProvider } from '../i18n'
import { getEnMessagesSnapshot, getLocaleMessagesSnapshot, getLocaleRawSnapshot } from '../i18n/localeRegistry'
import { EditorTabBar } from './components/EditorTabBar'
import {
  dispatchDocumentCommand,
  registerDocumentRuntimeCapabilities,
  resetDocumentRuntimeKernel,
} from '../documentRuntime/documentKernel'
import { joinRelativePath } from '../lib/workspacePathUtils'
import { markAppSettingsHydratedForTests } from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'
import { buildTemplateContext } from '../templates/templateService'
import { renderTemplateString } from '../templates/renderTemplate'
import {
  DEFAULT_WORKSPACE_CONFIG,
  type WorkspaceConfig,
} from '../workspace/workspaceConfigTypes'
import { resolveDailyNoteRelativePath } from '../workspace/workspaceConfig'

const QA_ROOT = '/qa-vault-daily'

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
  'app.tabs.listMenuAria': 'Show all open tabs ({current}/{max})',
  'app.tabs.listMenuTitle': 'Open tabs',
  'app.tabs.limitHint': 'Tab limit approaching',
  'app.tabs.limitReached': 'Tab limit reached',
}

function t(key: string): string {
  return TAB_MESSAGES[key] ?? key
}

declare global {
  interface Window {
    __QA_DAILY_NOTE__?: {
      getWorkspaceRoot: () => string
      getActivePath: () => string
      getOpenedTabs: () => string[]
      getDiskContent: (absolutePath: string) => string | null
      getLastOpenedRelativePath: () => string | null
      isDailyNotesEnabled: () => boolean
      setDailyNotesEnabled: (enabled: boolean) => void
      openDailyNote: (dayOffset?: number) => Promise<string | null>
      resolveRelativePath: (dayOffset?: number) => string
    }
  }
}

function QaDailyNoteInner() {
  const [status, setStatus] = useState('booting')
  const [openedTabs, setOpenedTabs] = useState<string[]>([])
  const [activePath, setActivePath] = useState('')
  const [previewMarkdown, setPreviewMarkdown] = useState('')

  const diskStoreRef = useRef<Record<string, string>>({
    [`${QA_ROOT}/Templates/Daily.md`]: '# {{title}}\n\nDaily note for {{date:YYYY-MM-DD}}.\n',
  })
  const configRef = useRef<WorkspaceConfig>({ ...DEFAULT_WORKSPACE_CONFIG })
  const activePathRef = useRef('')
  const openedTabsRef = useRef<string[]>([])
  const lastRelativePathRef = useRef<string | null>(null)

  activePathRef.current = activePath
  openedTabsRef.current = openedTabs

  const tabLabel = useCallback((path: string) => path.split('/').pop() ?? path, [])

  const readDisk = useCallback((path: string) => {
    const body = diskStoreRef.current[path]
    if (body == null) throw new Error(`missing:${path}`)
    return body
  }, [])

  const resolveRelativeForOffset = useCallback((dayOffset = 0) => {
    const when = new Date()
    when.setDate(when.getDate() + dayOffset)
    return resolveDailyNoteRelativePath(configRef.current, when)
  }, [])

  const resolveOrCreateAbsolute = useCallback(
    async (dayOffset = 0): Promise<string | null> => {
      const daily = configRef.current.dailyNotes ?? {}
      if (daily.enabled === false) return null

      const when = new Date()
      when.setDate(when.getDate() + dayOffset)
      const relativePath = resolveDailyNoteRelativePath(configRef.current, when)
      lastRelativePathRef.current = relativePath
      const absolutePath = joinRelativePath(QA_ROOT, relativePath)

      if (diskStoreRef.current[absolutePath]) {
        return absolutePath
      }

      const stem = relativePath.split('/').pop()?.replace(/\.md$/i, '') ?? 'daily'
      const folder = relativePath.includes('/')
        ? relativePath.slice(0, relativePath.lastIndexOf('/'))
        : undefined
      const ctx = buildTemplateContext({
        root: QA_ROOT,
        title: stem,
        filename: stem,
        folder,
        now: when,
      })
      const templateRel = (daily.template ?? 'Templates/Daily.md').replace(/\\/g, '/')
      const templateAbs = joinRelativePath(QA_ROOT, templateRel)
      const raw = diskStoreRef.current[templateAbs] ?? '# {{title}}\n\n'
      const content = renderTemplateString(raw, ctx)
      diskStoreRef.current[absolutePath] = content
      return absolutePath
    },
    [],
  )

  const openDailyNote = useCallback(
    async (dayOffset = 0): Promise<string | null> => {
      const absolutePath = await resolveOrCreateAbsolute(dayOffset)
      if (!absolutePath) {
        setStatus('disabled')
        return null
      }
      await dispatchDocumentCommand({
        type: 'OPEN_DOCUMENT_IN_TAB',
        root: QA_ROOT,
        path: absolutePath,
        source: 'daily-note',
      })
      setStatus(dayOffset === 0 ? 'opened-today' : dayOffset === -1 ? 'opened-yesterday' : 'opened-tomorrow')
      return absolutePath
    },
    [resolveOrCreateAbsolute],
  )

  useEffect(() => {
    markAppSettingsHydratedForTests({ ...DEFAULT_APP_SETTINGS, language: 'en' })
  }, [])

  useEffect(() => {
    resetDocumentRuntimeKernel()

    registerDocumentRuntimeCapabilities({
      readDocument: async (_root, path) => readDisk(path),
      readDocumentForVerify: async (_root, path) => readDisk(path),
      writeDocument: async (_root, path, markdown) => {
        diskStoreRef.current[path] = markdown
      },
      setActiveDocument: (path, markdown) => {
        activePathRef.current = path
        setActivePath(path)
        setPreviewMarkdown(markdown)
      },
      renderContent: (markdown) => {
        setPreviewMarkdown(markdown)
      },
      setTabs: (tabs) => {
        setOpenedTabs(Array.isArray(tabs) ? [...tabs] : tabs(openedTabsRef.current))
      },
      onDocumentOpened: () => undefined,
      onDocumentSaved: () => undefined,
      onOpenTabLimitReached: () => undefined,
    })

    void (async () => {
      setStatus('ready')
    })()

    return () => {
      resetDocumentRuntimeKernel()
    }
  }, [readDisk])

  useEffect(() => {
    window.__QA_DAILY_NOTE__ = {
      getWorkspaceRoot: () => QA_ROOT,
      getActivePath: () => activePathRef.current,
      getOpenedTabs: () => [...openedTabsRef.current],
      getDiskContent: (absolutePath) => diskStoreRef.current[absolutePath] ?? null,
      getLastOpenedRelativePath: () => lastRelativePathRef.current,
      isDailyNotesEnabled: () => configRef.current.dailyNotes?.enabled !== false,
      setDailyNotesEnabled: (enabled) => {
        configRef.current = {
          ...configRef.current,
          dailyNotes: { ...configRef.current.dailyNotes, enabled },
        }
      },
      openDailyNote,
      resolveRelativePath: resolveRelativeForOffset,
    }
    return () => {
      delete window.__QA_DAILY_NOTE__
    }
  }, [openDailyNote, resolveRelativeForOffset])

  return (
    <div className="qa-daily-note-shell" style={{ padding: 24, minHeight: '100vh', background: 'var(--surface-app)' }}>
      <h1 data-testid="qa-ready">Daily note QA</h1>
      <p data-testid="qa-status">{status}</p>
      <p data-testid="qa-active-path">{activePath}</p>
      <p data-testid="qa-last-relative">{lastRelativePathRef.current ?? ''}</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" data-testid="qa-open-today" onClick={() => void openDailyNote(0)}>
          Open today
        </button>
        <button type="button" data-testid="qa-open-yesterday" onClick={() => void openDailyNote(-1)}>
          Open yesterday
        </button>
        <button type="button" data-testid="qa-open-tomorrow" onClick={() => void openDailyNote(1)}>
          Open tomorrow
        </button>
      </div>

      <EditorTabBar
        t={t}
        openedTabs={openedTabs}
        activePath={activePath}
        externalDiskChangedPaths={new Set()}
        tabLabel={tabLabel}
        onActivate={(path) => {
          void dispatchDocumentCommand({
            type: 'OPEN_DOCUMENT',
            root: QA_ROOT,
            path,
            source: 'qa-daily-note-tab',
          })
        }}
        onClose={() => {}}
        onReorder={() => {}}
        onContextMenu={() => {}}
      />

      <pre
        data-testid="qa-daily-note-preview"
        style={{
          marginTop: 16,
          padding: 12,
          background: 'var(--surface-panel)',
          color: 'var(--text-primary)',
          borderRadius: 8,
          minHeight: 120,
          whiteSpace: 'pre-wrap',
        }}
      >
        {previewMarkdown || '(no document)'}
      </pre>
    </div>
  )
}

export function QaDailyNotePlayground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaDailyNoteInner />
    </I18nProvider>
  )
}
