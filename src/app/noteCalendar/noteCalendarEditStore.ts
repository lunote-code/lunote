import { isTauri } from '@tauri-apps/api/core'

import { ensureLunaDirs } from '../../lunaPaths'
import { relativePathUnderRoot } from '../../lib/workspacePathUtils'
import {
  readLunaNoteCalendarEdits,
  writeLunaNoteCalendarEdits,
  type NoteCalendarEditsIndexRecord,
} from '../../platform/tauri/persistenceService'
import type { FlatWorkspaceFile } from '../workspace/types'
import { isMarkdownWorkspaceFile } from './noteCalendarModel'

export const NOTE_CALENDAR_EDITS_VERSION = 1

const WEB_STORAGE_PREFIX = 'luna:note-calendar-edits:'

export function normalizeNoteCalendarRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\.\//u, '')
}

export function noteCalendarEditsMapFromRecord(
  record: NoteCalendarEditsIndexRecord | null | undefined,
): Map<string, number> {
  const map = new Map<string, number>()
  if (!record?.edits) return map
  for (const [relativePath, editedAtMs] of Object.entries(record.edits)) {
    if (!Number.isFinite(editedAtMs)) continue
    map.set(normalizeNoteCalendarRelativePath(relativePath), editedAtMs)
  }
  return map
}

export function noteCalendarEditsRecordFromMap(
  edits: ReadonlyMap<string, number>,
  updatedAt = Date.now(),
): NoteCalendarEditsIndexRecord {
  const out: Record<string, number> = {}
  for (const [relativePath, editedAtMs] of edits.entries()) {
    if (!Number.isFinite(editedAtMs)) continue
    out[normalizeNoteCalendarRelativePath(relativePath)] = editedAtMs
  }
  return {
    version: NOTE_CALENDAR_EDITS_VERSION,
    edits: out,
    updatedAt,
  }
}

export function pruneNoteCalendarEditsToKnownFiles(
  edits: ReadonlyMap<string, number>,
  files: readonly FlatWorkspaceFile[],
): Map<string, number> {
  const known = new Set(
    files
      .filter((file) => isMarkdownWorkspaceFile(file))
      .map((file) => normalizeNoteCalendarRelativePath(file.relativePath)),
  )
  const next = new Map<string, number>()
  for (const [relativePath, editedAtMs] of edits.entries()) {
    if (!known.has(relativePath)) continue
    next.set(relativePath, editedAtMs)
  }
  return next
}

function emptyNoteCalendarEditsIndex(): NoteCalendarEditsIndexRecord {
  return {
    version: NOTE_CALENDAR_EDITS_VERSION,
    edits: {},
    updatedAt: 0,
  }
}

function readWebNoteCalendarEditsIndex(workspaceId: string): NoteCalendarEditsIndexRecord {
  const raw = localStorage.getItem(`${WEB_STORAGE_PREFIX}${workspaceId}`)
  if (!raw) return emptyNoteCalendarEditsIndex()
  try {
    const parsed = JSON.parse(raw) as NoteCalendarEditsIndexRecord
    return {
      version: parsed.version ?? NOTE_CALENDAR_EDITS_VERSION,
      edits: parsed.edits ?? {},
      updatedAt: parsed.updatedAt ?? 0,
    }
  } catch {
    return emptyNoteCalendarEditsIndex()
  }
}

function writeWebNoteCalendarEditsIndex(
  workspaceId: string,
  index: NoteCalendarEditsIndexRecord,
): void {
  localStorage.setItem(`${WEB_STORAGE_PREFIX}${workspaceId}`, JSON.stringify(index))
}

export async function loadNoteCalendarEditsIndex(
  workspaceId: string,
): Promise<NoteCalendarEditsIndexRecord> {
  if (!isTauri()) return readWebNoteCalendarEditsIndex(workspaceId)
  await ensureLunaDirs()
  return readLunaNoteCalendarEdits(workspaceId)
}

export async function persistNoteCalendarEditsIndex(
  workspaceId: string,
  index: NoteCalendarEditsIndexRecord,
): Promise<void> {
  if (!isTauri()) {
    writeWebNoteCalendarEditsIndex(workspaceId, index)
    return
  }
  await ensureLunaDirs()
  await writeLunaNoteCalendarEdits(workspaceId, index)
}

const timers = new Map<string, number>()
const writeQueues = new Map<string, Promise<void>>()
const latestRecords = new Map<string, NoteCalendarEditsIndexRecord>()

export function scheduleNoteCalendarEditsPersist(
  workspaceId: string,
  edits: ReadonlyMap<string, number>,
  debounceMs = 500,
): void {
  const record = noteCalendarEditsRecordFromMap(edits)
  latestRecords.set(workspaceId, record)
  const existing = timers.get(workspaceId)
  if (existing != null) window.clearTimeout(existing)
  const timer = window.setTimeout(() => {
    timers.delete(workspaceId)
    const latest = latestRecords.get(workspaceId) ?? record
    const prev = writeQueues.get(workspaceId) ?? Promise.resolve()
    const next = prev
      .catch(() => undefined)
      .then(() => persistNoteCalendarEditsIndex(workspaceId, latest))
    writeQueues.set(workspaceId, next)
  }, debounceMs)
  timers.set(workspaceId, timer)
}

export async function flushNoteCalendarEditsWrites(): Promise<void> {
  for (const [workspaceId, timer] of timers) {
    window.clearTimeout(timer)
    timers.delete(workspaceId)
    const latest = latestRecords.get(workspaceId)
    if (!latest) continue
    const prev = writeQueues.get(workspaceId) ?? Promise.resolve()
    const next = prev
      .catch(() => undefined)
      .then(() => persistNoteCalendarEditsIndex(workspaceId, latest))
    writeQueues.set(workspaceId, next)
  }
  await Promise.all([...writeQueues.values()].map((task) => task.catch(() => undefined)))
}

export function recordNoteCalendarEditInMap(
  edits: ReadonlyMap<string, number>,
  relativePath: string,
  editedAtMs: number,
): Map<string, number> {
  const next = new Map(edits)
  next.set(normalizeNoteCalendarRelativePath(relativePath), editedAtMs)
  return next
}

export function mergeNoteCalendarEditsMaps(
  ...maps: ReadonlyArray<ReadonlyMap<string, number>>
): Map<string, number> {
  const next = new Map<string, number>()
  for (const map of maps) {
    for (const [relativePath, editedAtMs] of map.entries()) {
      if (!Number.isFinite(editedAtMs)) continue
      const normalized = normalizeNoteCalendarRelativePath(relativePath)
      const existing = next.get(normalized)
      if (existing == null || editedAtMs > existing) {
        next.set(normalized, editedAtMs)
      }
    }
  }
  return next
}

export function migrateNoteCalendarEditsForRelativeRename(
  edits: ReadonlyMap<string, number>,
  oldRelPrefix: string,
  newRelPrefix: string,
): Map<string, number> {
  const oldPrefix = normalizeNoteCalendarRelativePath(oldRelPrefix).replace(/\/+$/, '')
  const newPrefix = normalizeNoteCalendarRelativePath(newRelPrefix).replace(/\/+$/, '')
  const next = new Map<string, number>()
  for (const [relativePath, editedAtMs] of edits.entries()) {
    const normalized = normalizeNoteCalendarRelativePath(relativePath)
    if (normalized === oldPrefix || normalized.startsWith(`${oldPrefix}/`)) {
      const suffix = normalized === oldPrefix ? '' : normalized.slice(oldPrefix.length)
      const migrated = `${newPrefix}${suffix}`
      const existing = next.get(migrated)
      next.set(migrated, existing == null || editedAtMs > existing ? editedAtMs : existing)
    } else {
      next.set(normalized, editedAtMs)
    }
  }
  return next
}

export function migrateNoteCalendarEditsForPathRename(
  edits: ReadonlyMap<string, number>,
  rootDir: string,
  oldAbsolutePath: string,
  newAbsolutePath: string,
): Map<string, number> {
  const oldRel = resolveNoteCalendarRelativePath(rootDir, oldAbsolutePath)
  const newRel = resolveNoteCalendarRelativePath(rootDir, newAbsolutePath)
  if (!oldRel || !newRel) return new Map(edits)
  return migrateNoteCalendarEditsForRelativeRename(edits, oldRel, newRel)
}

export function resolveNoteCalendarRelativePath(
  rootDir: string,
  absolutePath: string,
): string | null {
  const relativePath = relativePathUnderRoot(rootDir, absolutePath)
  if (relativePath == null || !relativePath.trim()) return null
  return normalizeNoteCalendarRelativePath(relativePath)
}
