import { joinRelativePath, normPath, pathHasParentDirSegment } from '../lib/workspacePathUtils'
import { readNote, saveNote } from '../platform/tauri/documentService'
import {
  DEFAULT_WORKSPACE_CONFIG,
  WORKSPACE_CONFIG_RELATIVE_PATH,
  type WorkspaceConfig,
  type WorkspaceDailyNotesConfig,
} from './workspaceConfigTypes'
import { formatDateWithPattern } from '../templates/formatDateTokens'

function mergeConfig(raw: Partial<WorkspaceConfig> | null | undefined): WorkspaceConfig {
  const recentTemplates = Array.isArray(raw?.templates?.recentlyUsed)
    ? raw?.templates?.recentlyUsed.filter((value): value is string => typeof value === 'string')
    : DEFAULT_WORKSPACE_CONFIG.templates?.recentlyUsed ?? []
  return {
    ...DEFAULT_WORKSPACE_CONFIG,
    ...raw,
    version: typeof raw?.version === 'number' ? raw.version : 1,
    templates: {
      ...DEFAULT_WORKSPACE_CONFIG.templates,
      ...raw?.templates,
      recentlyUsed: recentTemplates,
    },
    dailyNotes: {
      ...DEFAULT_WORKSPACE_CONFIG.dailyNotes,
      ...raw?.dailyNotes,
    },
  }
}

export async function readWorkspaceConfig(root: string): Promise<WorkspaceConfig> {
  const trimmed = root.trim()
  if (!trimmed) return { ...DEFAULT_WORKSPACE_CONFIG }
  try {
    const raw = await readNote(trimmed, WORKSPACE_CONFIG_RELATIVE_PATH)
    const parsed = JSON.parse(raw) as Partial<WorkspaceConfig>
    return mergeConfig(parsed)
  } catch {
    return mergeConfig(undefined)
  }
}

export async function writeWorkspaceConfig(root: string, config: WorkspaceConfig): Promise<void> {
  const trimmed = root.trim()
  if (!trimmed) return
  const payload = mergeConfig(config)
  await saveNote(trimmed, WORKSPACE_CONFIG_RELATIVE_PATH, `${JSON.stringify(payload, null, 2)}\n`, {
    forceOverwrite: true,
  })
}

export function resolveDailyNoteRelativePath(
  config: WorkspaceConfig,
  date: Date = new Date(),
): string {
  const daily = config.dailyNotes ?? {}
  const folder = (daily.folder ?? 'Daily').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  const format = daily.format ?? 'YYYY-MM-DD'
  const stem = formatDateWithPattern(date, format)
  if (!stem || pathHasParentDirSegment(stem) || stem.includes('/')) {
    throw new Error('Invalid daily note date format')
  }
  return folder ? `${folder}/${stem}.md` : `${stem}.md`
}

export function workspaceConfigAbsolutePath(root: string, relativePath: string): string {
  return joinRelativePath(root, relativePath.replace(/\\/g, '/'))
}

export function getEffectiveDailyNotesConfig(config: WorkspaceConfig): WorkspaceDailyNotesConfig {
  return {
    ...DEFAULT_WORKSPACE_CONFIG.dailyNotes,
    ...config.dailyNotes,
  }
}

export function vaultFolderName(root: string): string {
  const normalized = normPath(root)
  const parts = normalized.split('/').filter(Boolean)
  return parts.at(-1) ?? normalized
}
