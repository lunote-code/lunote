import { useCallback, useMemo, useState } from 'react'

import '../App.css'
import { I18nProvider, useI18n } from '../i18n'
import {
  getEnMessagesSnapshot,
  getLocaleMessagesSnapshot,
  getLocaleRawSnapshot,
} from '../i18n/localeRegistry'
import { markAppSettingsHydratedForTests } from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'
import { NoteCalendarPanel } from './components/NoteCalendarPanel'
import { SidebarPanelViewSegmented } from './components/SidebarHeaderChrome'
import {
  normalizeNoteCalendarRelativePath,
  recordNoteCalendarEditInMap,
} from './noteCalendar/noteCalendarEditStore'
import {
  collectNotesByModifiedDate,
  localDateKey,
  notesEditedOnDate,
} from './noteCalendar/noteCalendarModel'
import type { FlatWorkspaceFile } from './workspace/types'
import type { SidebarPanelView } from './workspace/sidebarPanelView'

const QA_ROOT = '/qa-vault'

const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

function buildSampleFiles(now: Date, bulkTodayCount = 0): FlatWorkspaceFile[] {
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const todayMs = now.getTime()
  const yesterdayMs = yesterday.getTime()

  const files: FlatWorkspaceFile[] = [
    {
      path: `${QA_ROOT}/today-note.md`,
      label: 'today-note',
      relativePath: 'today-note.md',
      modifiedAtMs: todayMs,
    },
    {
      path: `${QA_ROOT}/also-today.md`,
      label: 'also-today',
      relativePath: 'also-today.md',
      modifiedAtMs: todayMs - 60_000,
    },
    {
      path: `${QA_ROOT}/archive/yesterday-note.md`,
      label: 'yesterday-note',
      relativePath: 'archive/yesterday-note.md',
      modifiedAtMs: yesterdayMs,
    },
  ]

  for (let index = 0; index < bulkTodayCount; index += 1) {
    files.push({
      path: `${QA_ROOT}/bulk/note-${index}.md`,
      label: `bulk-note-${index}`,
      relativePath: `bulk/note-${index}.md`,
      modifiedAtMs: todayMs - (index + 2) * 1_000,
    })
  }

  return files
}

function seedPersistedEditsFromFiles(files: readonly FlatWorkspaceFile[]): Map<string, number> {
  const edits = new Map<string, number>()
  for (const file of files) {
    if (file.modifiedAtMs == null || !Number.isFinite(file.modifiedAtMs)) continue
    edits.set(normalizeNoteCalendarRelativePath(file.relativePath), file.modifiedAtMs)
  }
  return edits
}

function readBulkTodayCountFromQuery(): number {
  const raw = new URLSearchParams(window.location.search).get('bulk')
  if (!raw) return 0
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function readEmptyEditsFromQuery(): boolean {
  return new URLSearchParams(window.location.search).get('emptyEdits') === '1'
}

declare global {
  interface Window {
    __QA_NOTE_CALENDAR__?: {
      getActivePath: () => string
      getOpenedPath: () => string
      getSelectedDateKey: () => string
      getTodayDateKey: () => string
      getYesterdayDateKey: () => string
      getVisibleNotePaths: () => string[]
      getNoteCountForDate: (dateKey: string) => number
      getTotalIndexedNoteCount: () => number
      getDaysWithNotesCount: () => number
      loadBulkTodayNotes: (count: number) => void
      touchTodayNote: () => void
    }
  }
}

function QaNoteCalendarInner() {
  const { t, effectiveLocale } = useI18n()
  const [sidebarPanelView, setSidebarPanelView] = useState<SidebarPanelView>('calendar')
  const [activePath, setActivePath] = useState('')
  const [openedPath, setOpenedPath] = useState('')
  const [files, setFiles] = useState(() => buildSampleFiles(new Date(), readBulkTodayCountFromQuery()))
  const [noteCalendarEdits, setNoteCalendarEdits] = useState(() =>
    readEmptyEditsFromQuery()
      ? new Map<string, number>()
      : seedPersistedEditsFromFiles(buildSampleFiles(new Date(), readBulkTodayCountFromQuery())),
  )

  const touchTodayNote = useCallback(() => {
    const editedAtMs = Date.now()
    setNoteCalendarEdits((prev) => recordNoteCalendarEditInMap(prev, 'today-note.md', editedAtMs))
  }, [])

  const loadBulkTodayNotes = useCallback((count: number) => {
    const safeCount = Math.max(0, Math.floor(count))
    const nextFiles = buildSampleFiles(new Date(), safeCount)
    setFiles(nextFiles)
    setNoteCalendarEdits(seedPersistedEditsFromFiles(nextFiles))
  }, [])

  const notesByDate = useMemo(
    () => collectNotesByModifiedDate(files, noteCalendarEdits, true),
    [files, noteCalendarEdits],
  )
  const today = new Date()
  const todayKey = localDateKey(today)
  const yesterdayKey = localDateKey(new Date(today.getTime() - 86_400_000))

  window.__QA_NOTE_CALENDAR__ = {
    getActivePath: () => activePath,
    getOpenedPath: () => openedPath,
    getSelectedDateKey: () => todayKey,
    getTodayDateKey: () => todayKey,
    getYesterdayDateKey: () => yesterdayKey,
    getVisibleNotePaths: () => notesEditedOnDate(todayKey, notesByDate).map((file) => file.path),
    getNoteCountForDate: (dateKey) => notesEditedOnDate(dateKey, notesByDate).length,
    getTotalIndexedNoteCount: () => {
      let total = 0
      for (const bucket of notesByDate.values()) total += bucket.length
      return total
    },
    getDaysWithNotesCount: () => notesByDate.size,
    loadBulkTodayNotes,
    touchTodayNote,
  }

  return (
    <div className="qa-sidebar-chrome-root qa-note-calendar-root">
      <aside className="sidebar workspace-split mod-left-split qa-sidebar-chrome-shell" data-workspace-sidebar>
        <div className="sidebar-pane-top">
          <div className="sidebar-header">
            <div className="sidebar-header-primary">
              <SidebarPanelViewSegmented
                t={t}
                view={sidebarPanelView}
                filesDisabled={false}
                onSelectView={setSidebarPanelView}
              />
            </div>
          </div>
        </div>
        <div className="sidebar-scroll">
          {sidebarPanelView === 'calendar' ? (
            <div className="file-list file-list--outline-root">
              <NoteCalendarPanel
                t={t}
                locale={effectiveLocale}
                rootDir={QA_ROOT}
                activePath={activePath}
                workspaceFiles={files}
                noteCalendarEdits={noteCalendarEdits}
                noteCalendarPreferPersistedOnly
                onOpenNote={(path) => {
                  setActivePath(path)
                  setOpenedPath(path)
                }}
              />
            </div>
          ) : (
            <p className="sidebar-inline-empty">Switch to calendar view</p>
          )}
        </div>
      </aside>
      <div className="qa-sidebar-chrome-diagnostics">
        <p data-testid="qa-ready">ready</p>
        <p data-testid="qa-status">ready</p>
        <p data-testid="qa-note-calendar-ready">Note calendar QA</p>
        <p data-testid="qa-active-path">{activePath || '(none)'}</p>
        <p data-testid="qa-opened-path">{openedPath || '(none)'}</p>
      </div>
    </div>
  )
}

export function QaNoteCalendarPlayground() {
  markAppSettingsHydratedForTests(DEFAULT_APP_SETTINGS)
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaNoteCalendarInner />
    </I18nProvider>
  )
}
