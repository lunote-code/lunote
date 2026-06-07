import { refreshWorkspaceIndex } from '../app/workspace/workspaceIndexCoordinator'
import { dispatchDocumentCommand } from '../documentRuntime/documentKernel'
import { joinRelativePath } from '../lib/workspacePathUtils'
import { pathExists } from '../platform/tauri/platformPathService'
import { createNote } from '../platform/tauri/documentService'
import {
  getEffectiveDailyNotesConfig,
  readWorkspaceConfig,
  resolveDailyNoteRelativePath,
} from '../workspace/workspaceConfig'
import {
  buildTemplateContext,
  ensureDefaultTemplateFiles,
  renderNoteFromTemplate,
} from './templateService'

export type OpenDailyNoteOptions = {
  openInTab?: boolean
  date?: Date
}

/** Result of attempting to open a daily note from the app shell. */
export type OpenDailyNoteOutcome = 'opened' | 'disabled' | 'no-workspace'

export async function isDailyNotesEnabled(root: string): Promise<boolean> {
  const trimmed = root.trim()
  if (!trimmed) return false
  const config = await readWorkspaceConfig(trimmed)
  return getEffectiveDailyNotesConfig(config).enabled !== false
}

function dateWithDayOffset(base: Date, dayOffset: number): Date {
  const next = new Date(base)
  next.setDate(next.getDate() + dayOffset)
  return next
}

/** Create or resolve today's (or dated) daily note path without opening it in the editor. */
export async function resolveOrCreateDailyNotePath(
  root: string,
  options: OpenDailyNoteOptions = {},
): Promise<string | null> {
  const trimmed = root.trim()
  if (!trimmed) return null

  const config = await readWorkspaceConfig(trimmed)
  const daily = getEffectiveDailyNotesConfig(config)
  if (daily.enabled === false) return null

  await ensureDefaultTemplateFiles(trimmed, config)

  const when = options.date ?? new Date()
  const relativePath = resolveDailyNoteRelativePath(config, when)
  const exists = await pathExists(trimmed, relativePath)

  if (exists) {
    return joinRelativePath(trimmed, relativePath)
  }

  const stem = relativePath.split('/').pop()?.replace(/\.md$/i, '') ?? 'daily'
  const folder = relativePath.includes('/')
    ? relativePath.slice(0, relativePath.lastIndexOf('/'))
    : undefined
  const ctx = buildTemplateContext({
    root: trimmed,
    title: stem,
    filename: stem,
    folder,
    now: when,
  })
  const content = await renderNoteFromTemplate(trimmed, daily.template, ctx)
  const absolutePath = await createNote({
    root: trimmed,
    relativePath,
    content,
  })
  await refreshWorkspaceIndex(trimmed)
  return absolutePath
}

export async function openDailyNote(
  root: string,
  options: OpenDailyNoteOptions = {},
): Promise<string | null> {
  const trimmed = root.trim()
  if (!trimmed) return null

  const absolutePath = await resolveOrCreateDailyNotePath(trimmed, options)
  if (!absolutePath) return null

  await dispatchDocumentCommand({
    type: 'OPEN_DOCUMENT_IN_TAB',
    root: trimmed,
    path: absolutePath,
    source: 'daily-note',
  })
  return absolutePath
}

export async function openRelativeDailyNote(
  root: string,
  dayOffset: number,
  options: Omit<OpenDailyNoteOptions, 'date'> = {},
): Promise<string | null> {
  return openDailyNote(root, {
    ...options,
    date: dateWithDayOffset(new Date(), dayOffset),
  })
}

export async function shouldOpenDailyNoteOnStartup(root: string): Promise<boolean> {
  if (!root.trim()) return false
  const config = await readWorkspaceConfig(root)
  return getEffectiveDailyNotesConfig(config).openOnStartup === true
}
