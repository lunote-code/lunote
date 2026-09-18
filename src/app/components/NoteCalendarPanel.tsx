import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import { Icon } from '../../design-system/icons'
import type { TranslateFn } from '../../i18n'
import { pathsEqual } from '../../lib/workspacePathUtils'
import type { FlatWorkspaceFile } from '../workspace/types'
import {
  buildCalendarMonthGrid,
  collectNotesByModifiedDate,
  dateHasEditedNotes,
  localDateKey,
  notesEditedOnDate,
  resolveDateKeyForActivePath,
  weekStartsOnMonday,
} from '../noteCalendar/noteCalendarModel'

type Props = {
  t: TranslateFn
  locale: string
  rootDir: string
  activePath: string
  workspaceFiles: readonly FlatWorkspaceFile[]
  noteCalendarEdits?: ReadonlyMap<string, number>
  noteCalendarPreferPersistedOnly?: boolean
  onOpenNote: (path: string) => void
}

export function NoteCalendarPanel({
  t,
  locale,
  rootDir,
  activePath,
  workspaceFiles,
  noteCalendarEdits,
  noteCalendarPreferPersistedOnly = false,
  onOpenNote,
}: Props) {
  const [today, setToday] = useState(() => new Date())
  const todayKey = localDateKey(today)
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey)
  const weekStartsOn: 0 | 1 = weekStartsOnMonday(locale) ? 1 : 0

  useEffect(() => {
    const refreshToday = () => setToday(new Date())
    const timer = window.setInterval(refreshToday, 60_000)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshToday()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  const notesByDate = useMemo(
    () => collectNotesByModifiedDate(workspaceFiles, noteCalendarEdits, noteCalendarPreferPersistedOnly),
    [noteCalendarEdits, noteCalendarPreferPersistedOnly, workspaceFiles],
  )

  const syncedActivePathRef = useRef('')

  useEffect(() => {
    syncedActivePathRef.current = ''
  }, [rootDir])

  useEffect(() => {
    if (!activePath.trim()) return
    if (syncedActivePathRef.current === activePath) return
    syncedActivePathRef.current = activePath
    const key = resolveDateKeyForActivePath(
      activePath,
      workspaceFiles,
      noteCalendarEdits,
      noteCalendarPreferPersistedOnly,
    )
    if (!key) return
    setSelectedDateKey(key)
    const [year, month] = key.split('-').map((part) => Number(part))
    if (!year || !month) return
    setViewDate(new Date(year, month - 1, 1))
  }, [activePath, noteCalendarEdits, noteCalendarPreferPersistedOnly, workspaceFiles])

  const viewYear = viewDate.getFullYear()
  const viewMonth = viewDate.getMonth()
  const monthGrid = useMemo(
    () => buildCalendarMonthGrid(viewYear, viewMonth, weekStartsOn),
    [viewMonth, viewYear, weekStartsOn],
  )

  const monthTitle = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(viewDate)
    } catch {
      return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
    }
  }, [locale, viewDate, viewMonth, viewYear])

  const selectedDateLabel = useMemo(() => {
    const [year, month, day] = selectedDateKey.split('-').map((part) => Number(part))
    if (!year || !month || !day) return selectedDateKey
    try {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(year, month - 1, day))
    } catch {
      return selectedDateKey
    }
  }, [locale, selectedDateKey])

  const selectedNotes = useMemo(
    () => notesEditedOnDate(selectedDateKey, notesByDate),
    [notesByDate, selectedDateKey],
  )

  const flatCells = useMemo(() => monthGrid.flat(), [monthGrid])

  const showEncryptedEmptyHint =
    Boolean(rootDir.trim()) &&
    noteCalendarPreferPersistedOnly &&
    notesByDate.size === 0

  const selectDate = useCallback((date: Date, dateKey: string, inMonth: boolean) => {
    setSelectedDateKey(dateKey)
    if (!inMonth) {
      setViewDate(new Date(date.getFullYear(), date.getMonth(), 1))
    }
  }, [])

  const focusDayRequestRef = useRef<string | null>(null)

  const requestFocusDay = useCallback((dateKey: string) => {
    focusDayRequestRef.current = dateKey
  }, [])

  useLayoutEffect(() => {
    const dateKey = focusDayRequestRef.current
    if (!dateKey) return
    focusDayRequestRef.current = null
    document
      .querySelector<HTMLButtonElement>(`.sidebar-note-calendar-day[data-date-key="${dateKey}"]`)
      ?.focus()
  })

  const focusDayButton = requestFocusDay

  const moveSelectedDay = useCallback(
    (delta: number) => {
      const currentIndex = flatCells.findIndex((cell) => cell.dateKey === selectedDateKey)
      if (currentIndex < 0) return
      let nextIndex = currentIndex + delta
      const step = delta > 0 ? 1 : -1
      while (nextIndex >= 0 && nextIndex < flatCells.length && !flatCells[nextIndex]?.inMonth) {
        nextIndex += step
      }
      const nextCell = flatCells[nextIndex]
      if (!nextCell?.inMonth) return
      selectDate(nextCell.date, nextCell.dateKey, true)
      focusDayButton(nextCell.dateKey)
    },
    [flatCells, focusDayButton, selectDate, selectedDateKey],
  )

  const shiftMonth = useCallback((delta: number) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }, [])

  const shiftViewMonth = useCallback(
    (delta: number) => {
      const nextMonthStart = new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1)
      const [, , dayPart] = selectedDateKey.split('-')
      const selectedDay = Number(dayPart) || 1
      const lastDay = new Date(nextMonthStart.getFullYear(), nextMonthStart.getMonth() + 1, 0).getDate()
      const clampedDay = Math.min(selectedDay, lastDay)
      const nextKey = localDateKey(
        new Date(nextMonthStart.getFullYear(), nextMonthStart.getMonth(), clampedDay),
      )
      setViewDate(nextMonthStart)
      setSelectedDateKey(nextKey)
      requestFocusDay(nextKey)
    },
    [requestFocusDay, selectedDateKey, viewDate],
  )

  const handleGridKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'PageUp') {
        event.preventDefault()
        shiftViewMonth(-1)
        return
      }
      if (event.key === 'PageDown') {
        event.preventDefault()
        shiftViewMonth(1)
        return
      }

      const currentIndex = flatCells.findIndex((cell) => cell.dateKey === selectedDateKey)
      if (currentIndex < 0) return

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault()
          moveSelectedDay(-1)
          return
        case 'ArrowRight':
          event.preventDefault()
          moveSelectedDay(1)
          return
        case 'ArrowUp':
          event.preventDefault()
          moveSelectedDay(-7)
          return
        case 'ArrowDown':
          event.preventDefault()
          moveSelectedDay(7)
          return
        case 'Home': {
          event.preventDefault()
          const rowStart = Math.floor(currentIndex / 7) * 7
          const nextCell = flatCells.slice(rowStart, rowStart + 7).find((cell) => cell.inMonth)
          if (!nextCell) return
          selectDate(nextCell.date, nextCell.dateKey, true)
          focusDayButton(nextCell.dateKey)
          return
        }
        case 'End': {
          event.preventDefault()
          const rowStart = Math.floor(currentIndex / 7) * 7
          const nextCell = [...flatCells.slice(rowStart, rowStart + 7)].reverse().find((cell) => cell.inMonth)
          if (!nextCell) return
          selectDate(nextCell.date, nextCell.dateKey, true)
          focusDayButton(nextCell.dateKey)
          return
        }
        default:
          return
      }
    },
    [flatCells, focusDayButton, moveSelectedDay, selectDate, selectedDateKey, shiftViewMonth],
  )

  const weekdayRow = useMemo(() => {
    const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
    const order = weekStartsOn === 1 ? ([1, 2, 3, 4, 5, 6, 0] as const) : ([0, 1, 2, 3, 4, 5, 6] as const)
    return order.map((index) => t(`app.noteCalendar.weekday.${keys[index]!}`))
  }, [t, weekStartsOn])

  const formatDayAriaLabel = useCallback(
    (dateKey: string, hasNote: boolean) => {
      const [year, month, day] = dateKey.split('-').map((part) => Number(part))
      let dateLabel = dateKey
      if (year && month && day) {
        try {
          dateLabel = new Intl.DateTimeFormat(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }).format(new Date(year, month - 1, day))
        } catch {
          dateLabel = dateKey
        }
      }
      return t('app.noteCalendar.dayAria', {
        date: dateLabel,
        hasNote: hasNote ? t('app.noteCalendar.hasNote') : t('app.noteCalendar.noNote'),
      })
    },
    [locale, t],
  )

  return (
    <div className="sidebar-note-calendar" data-testid="sidebar-note-calendar">
      <div className="sidebar-note-calendar-header">
        <div className="sidebar-note-calendar-nav">
          <button
            type="button"
            className="sidebar-note-calendar-nav-btn"
            aria-label={t('app.noteCalendar.prevMonth')}
            title={t('app.noteCalendar.prevMonth')}
            onClick={() => shiftMonth(-1)}
          >
            <Icon name="chevron-left" size="sm" tone="muted" stroke="regular" />
          </button>
          <div className="sidebar-note-calendar-title" aria-live="polite">
            {monthTitle}
          </div>
          <button
            type="button"
            className="sidebar-note-calendar-nav-btn"
            aria-label={t('app.noteCalendar.nextMonth')}
            title={t('app.noteCalendar.nextMonth')}
            onClick={() => shiftMonth(1)}
          >
            <Icon name="chevron-right" size="sm" tone="muted" stroke="regular" />
          </button>
        </div>
        <button
          type="button"
          className="sidebar-note-calendar-today-btn"
          aria-label={t('app.noteCalendar.today')}
          onClick={() => {
            setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
            setSelectedDateKey(todayKey)
          }}
        >
          {t('app.noteCalendar.today')}
        </button>
      </div>

      <div className="sidebar-note-calendar-body">
        <div className="sidebar-note-calendar-weekdays" aria-hidden="true">
          {weekdayRow.map((label) => (
            <span key={label} className="sidebar-note-calendar-weekday">
              {label}
            </span>
          ))}
        </div>

        <div
          className="sidebar-note-calendar-grid"
          role="grid"
          aria-label={t('app.noteCalendar.gridAria')}
          onKeyDown={handleGridKeyDown}
        >
          {monthGrid.map((row, rowIndex) => (
            <div key={`row-${rowIndex}`} className="sidebar-note-calendar-grid-row" role="row">
              {row.map((cell) => {
                if (!cell.inMonth) {
                  return (
                    <span
                      key={cell.dateKey}
                      className="sidebar-note-calendar-day sidebar-note-calendar-day--placeholder"
                      role="presentation"
                      aria-hidden="true"
                    />
                  )
                }
                const hasNote = dateHasEditedNotes(cell.dateKey, notesByDate)
                const isToday = cell.dateKey === todayKey
                const isSelected = cell.dateKey === selectedDateKey
                const classes = [
                  'sidebar-note-calendar-day',
                  hasNote ? 'sidebar-note-calendar-day--has-note' : '',
                  isToday ? 'sidebar-note-calendar-day--today' : '',
                  isSelected ? 'sidebar-note-calendar-day--selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    role="gridcell"
                    className={classes}
                    data-date-key={cell.dateKey}
                    aria-label={formatDayAriaLabel(cell.dateKey, hasNote)}
                    aria-pressed={isSelected}
                    aria-selected={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => selectDate(cell.date, cell.dateKey, true)}
                  >
                    <span className="sidebar-note-calendar-day-num">{cell.date.getDate()}</span>
                    {hasNote ? <span className="sidebar-note-calendar-day-dot" aria-hidden="true" /> : null}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {!showEncryptedEmptyHint ? (
          <p className="sidebar-note-calendar-legend">
            <span className="sidebar-note-calendar-legend-dot" aria-hidden="true" />
            {t('app.noteCalendar.legend')}
          </p>
        ) : null}

        {showEncryptedEmptyHint ? (
          <p
            className="sidebar-note-calendar-hint"
            role="status"
            data-testid="sidebar-note-calendar-encrypted-hint"
          >
            {t('app.noteCalendar.encryptedEmptyHint')}
          </p>
        ) : null}
      </div>

      <section
        className="sidebar-note-calendar-notes"
        aria-label={t('app.noteCalendar.notesHeading', { date: selectedDateLabel })}
        data-testid="sidebar-note-calendar-notes"
      >
        <h3 className="sidebar-note-calendar-notes-title">
          {t('app.noteCalendar.notesHeading', { date: selectedDateLabel })}
          {selectedNotes.length > 0 ? (
            <span className="sidebar-note-calendar-notes-count">{selectedNotes.length}</span>
          ) : null}
        </h3>
        {!rootDir.trim() ? (
          <p className="sidebar-note-calendar-notes-empty">{t('app.menu.openWorkspaceFirst')}</p>
        ) : selectedNotes.length === 0 ? (
          <p className="sidebar-note-calendar-notes-empty">{t('app.noteCalendar.emptyDay')}</p>
        ) : (
          <ul className="sidebar-note-calendar-notes-list">
            {selectedNotes.map((file) => (
              <li key={file.path}>
                <button
                  type="button"
                  className={`note-item file-list-flat-item sidebar-note-calendar-note${pathsEqual(activePath, file.path) ? ' active' : ''}`}
                  onClick={() => onOpenNote(file.path)}
                >
                  <Icon name="note" size="md" className="tree-icon file-list-flat-icon" tone="muted" />
                  <span className="file-list-flat-text">
                    <span className="file-list-flat-label">{file.label}</span>
                    {file.sublabel ? <span className="file-list-flat-sublabel">{file.sublabel}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
