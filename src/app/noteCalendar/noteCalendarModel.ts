import type { FlatWorkspaceFile } from '../workspace/types'

function pathMatchKey(path: string): string {
  let normalized = path.trim().replace(/\\/g, '/').replace(/\/+$/, '')
  if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith('//')) {
    normalized = normalized.toLowerCase()
  }
  return normalized.normalize('NFC')
}

function activePathMatchesFile(activePath: string, file: FlatWorkspaceFile): boolean {
  const activeKey = pathMatchKey(activePath)
  return activeKey === pathMatchKey(file.path) || activeKey === pathMatchKey(file.relativePath)
}

export type CalendarMonthCell = {
  date: Date
  inMonth: boolean
  dateKey: string
}

export function localDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function localDateKeyFromMs(ms: number): string {
  return localDateKey(new Date(ms))
}

export function weekStartsOnMonday(locale: string): boolean {
  return locale.startsWith('zh') || locale.startsWith('ja') || locale.startsWith('ko') || locale.startsWith('de')
}

export function buildCalendarMonthGrid(
  year: number,
  month: number,
  weekStartsOn: 0 | 1,
): CalendarMonthCell[][] {
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = (firstOfMonth.getDay() - weekStartsOn + 7) % 7
  const gridStart = new Date(year, month, 1 - startOffset)

  const weeks: CalendarMonthCell[][] = []
  const cursor = new Date(gridStart)
  for (let week = 0; week < 6; week += 1) {
    const row: CalendarMonthCell[] = []
    for (let day = 0; day < 7; day += 1) {
      row.push({
        date: new Date(cursor),
        inMonth: cursor.getMonth() === month,
        dateKey: localDateKey(cursor),
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(row)
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
    const containsLastDayOfMonth = row.some(
      (cell) => cell.inMonth && cell.date.getDate() === lastDayOfMonth,
    )
    if (containsLastDayOfMonth) break
  }
  return weeks
}

export function isMarkdownWorkspaceFile(file: FlatWorkspaceFile): boolean {
  const rel = file.relativePath.replace(/\\/g, '/').toLowerCase()
  return rel.endsWith('.md') || rel.endsWith('.markdown')
}

export function modifiedDateKeyForFile(
  file: FlatWorkspaceFile,
  persistedEdits?: ReadonlyMap<string, number>,
  preferPersistedOnly = false,
): string | null {
  const ms = effectiveModifiedAtMsForFile(file, persistedEdits, preferPersistedOnly)
  if (ms == null) return null
  return localDateKeyFromMs(ms)
}

export function effectiveModifiedAtMsForFile(
  file: FlatWorkspaceFile,
  persistedEdits?: ReadonlyMap<string, number>,
  preferPersistedOnly = false,
): number | null {
  const relativePath = file.relativePath.replace(/\\/g, '/').replace(/^\.\//u, '')
  const persisted = persistedEdits?.get(relativePath)
  if (persisted != null && Number.isFinite(persisted)) return persisted
  if (preferPersistedOnly) return null
  const fsMs = file.modifiedAtMs ?? file.createdAtMs ?? null
  if (fsMs == null || !Number.isFinite(fsMs)) return null
  return fsMs
}

export function collectNotesByModifiedDate(
  files: readonly FlatWorkspaceFile[],
  persistedEdits?: ReadonlyMap<string, number>,
  preferPersistedOnly = false,
): Map<string, FlatWorkspaceFile[]> {
  const map = new Map<string, FlatWorkspaceFile[]>()
  for (const file of files) {
    if (!isMarkdownWorkspaceFile(file)) continue
    const dateKey = modifiedDateKeyForFile(file, persistedEdits, preferPersistedOnly)
    if (!dateKey) continue
    const bucket = map.get(dateKey)
    if (bucket) bucket.push(file)
    else map.set(dateKey, [file])
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => {
      const av = effectiveModifiedAtMsForFile(a, persistedEdits, preferPersistedOnly) ?? 0
      const bv = effectiveModifiedAtMsForFile(b, persistedEdits, preferPersistedOnly) ?? 0
      return bv - av
    })
  }
  return map
}

export function dateHasEditedNotes(
  dateKey: string,
  notesByDate: ReadonlyMap<string, FlatWorkspaceFile[]>,
): boolean {
  return (notesByDate.get(dateKey)?.length ?? 0) > 0
}

export function notesEditedOnDate(
  dateKey: string,
  notesByDate: ReadonlyMap<string, FlatWorkspaceFile[]>,
): FlatWorkspaceFile[] {
  return notesByDate.get(dateKey) ?? []
}

export function resolveDateKeyForActivePath(
  activePath: string,
  files: readonly FlatWorkspaceFile[],
  persistedEdits?: ReadonlyMap<string, number>,
  preferPersistedOnly = false,
): string | null {
  if (!activePath.trim()) return null
  for (const file of files) {
    if (activePathMatchesFile(activePath, file)) {
      return modifiedDateKeyForFile(file, persistedEdits, preferPersistedOnly)
    }
  }
  return null
}

export function weekdayLabels(weekStartsOn: 0 | 1): readonly string[] {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
  if (weekStartsOn === 1) return [...labels.slice(1), labels[0]!]
  return labels
}
