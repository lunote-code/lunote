import type { FsTreeNode } from '../app/workspace/types'
import { parentDirectoryOfFile, pathHasParentDirSegment, relativePathUnderRoot } from '../lib/workspacePathUtils'
import { createNote } from '../platform/tauri/documentService'
import { listWorkspaceTree } from '../platform/tauri/workspaceService'
import { readWorkspaceConfig, writeWorkspaceConfig } from '../workspace/workspaceConfig'
import { getDefaultNewNoteTemplate } from './defaultNoteContent'
import { resolveTemplateLocale } from './templateLocale'
import { renderTemplateString } from './renderTemplate'
import {
  buildTemplateContext,
  ensureDefaultTemplateFiles,
  loadTemplateContent,
} from './templateService'

import { isFileUnderWorkspaceFolder, normalizeWorkspaceRelPath } from './templatePathMatch'

function normalizeFolderRel(folder: string): string {
  return normalizeWorkspaceRelPath(folder)
}

export type WorkspaceTemplateEntry = {
  relativePath: string
  fileName: string
  displayName: string
  folderLabel?: string
  isRecent?: boolean
  recentRank?: number | null
}

const MAX_RECENT_TEMPLATES = 6
const PREVIEW_LINE_LIMIT = 10
const PREVIEW_CHAR_LIMIT = 420

function normalizeRelativeTemplatePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim()
}

function normalizeRecentTemplateList(values: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values ?? []) {
    const normalized = normalizeRelativeTemplatePath(value)
    if (!normalized || pathHasParentDirSegment(normalized) || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
    if (out.length >= MAX_RECENT_TEMPLATES) break
  }
  return out
}

function summarizeTemplatePreview(content: string): string {
  const compact = content.replace(/\r\n?/g, '\n').trim()
  if (!compact) return ''
  const lines = compact.split('\n').slice(0, PREVIEW_LINE_LIMIT)
  const joined = lines.join('\n')
  return joined.length > PREVIEW_CHAR_LIMIT ? `${joined.slice(0, PREVIEW_CHAR_LIMIT).trimEnd()}...` : joined
}

/** Walk workspace tree using names (not absolute paths) so listing works when root is canonicalized on disk. */
function walkTemplateFiles(
  nodes: readonly FsTreeNode[],
  folderRel: string,
  parentRel: string,
  out: WorkspaceTemplateEntry[],
): void {
  for (const node of nodes) {
    const relativePath = parentRel ? `${parentRel}/${node.name}` : node.name
    if (node.kind === 'directory') {
      walkTemplateFiles(node.children ?? [], folderRel, relativePath, out)
      continue
    }
    const lower = relativePath.toLowerCase()
    if (!(lower.endsWith('.md') || lower.endsWith('.markdown'))) continue
    if (!isFileUnderWorkspaceFolder(relativePath, folderRel)) continue
    const fileName = node.name || relativePath.split('/').at(-1) || relativePath
    const folderNorm = normalizeFolderRel(folderRel)
    const parent = parentDirectoryOfFile(relativePath)
    let folderLabel: string | undefined
    if (parent && parent !== folderNorm) {
      folderLabel = parent.startsWith(`${folderNorm}/`)
        ? parent.slice(folderNorm.length + 1)
        : parent
    }
    out.push({
      relativePath,
      fileName,
      displayName: fileName.replace(/\.(md|markdown)$/i, ''),
      folderLabel,
    })
  }
}

export async function listWorkspaceTemplates(root: string): Promise<WorkspaceTemplateEntry[]> {
  const config = await readWorkspaceConfig(root)
  await ensureDefaultTemplateFiles(root, config)
  const recent = normalizeRecentTemplateList(config.templates?.recentlyUsed)
  const folder = normalizeFolderRel(config.templates?.folder ?? 'Templates') || 'Templates'
  const tree = await listWorkspaceTree(root)
  const out: WorkspaceTemplateEntry[] = []
  walkTemplateFiles(tree, folder, '', out)
  out.sort((a, b) => {
    const rankA = recent.indexOf(a.relativePath)
    const rankB = recent.indexOf(b.relativePath)
    const normalizedRankA = rankA === -1 ? Number.MAX_SAFE_INTEGER : rankA
    const normalizedRankB = rankB === -1 ? Number.MAX_SAFE_INTEGER : rankB
    if (normalizedRankA !== normalizedRankB) return normalizedRankA - normalizedRankB
    return a.relativePath.localeCompare(b.relativePath)
  })
  for (const entry of out) {
    const rank = recent.indexOf(entry.relativePath)
    entry.isRecent = rank !== -1
    entry.recentRank = rank === -1 ? null : rank
  }
  return out
}

function sanitizeTemplateName(raw: string): string {
  const trimmed = raw.trim().replace(/\.md$/i, '').replace(/\.markdown$/i, '').trim()
  if (!trimmed) throw new Error('Template name is empty')
  if (trimmed === '.' || trimmed === '..' || /[/\\]/.test(trimmed) || pathHasParentDirSegment(trimmed)) {
    throw new Error('Invalid template name')
  }
  return trimmed
}

export async function createWorkspaceTemplate(root: string, rawName: string): Promise<string> {
  const config = await readWorkspaceConfig(root)
  await ensureDefaultTemplateFiles(root, config)
  const name = sanitizeTemplateName(rawName)
  const folder = (config.templates?.folder ?? 'Templates').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  const relativePath = folder ? `${folder}/${name}.md` : `${name}.md`
  const absolutePath = await createNote({
    root,
    relativePath,
    content: getDefaultNewNoteTemplate(resolveTemplateLocale()),
  })
  return relativePathUnderRoot(root, absolutePath) ?? relativePath
}

export async function loadWorkspaceTemplatePreview(root: string, relativePath: string): Promise<string> {
  const normalized = normalizeRelativeTemplatePath(relativePath)
  if (!normalized || pathHasParentDirSegment(normalized)) return ''
  const raw = await loadTemplateContent(root, normalized)
  if (!raw?.trim()) return ''
  const preview = renderTemplateString(
    raw,
    buildTemplateContext({
      root,
      title: 'Example note',
      filename: 'Example note',
      folder: 'Notes',
      now: new Date(2026, 0, 15, 9, 30, 0),
    }),
  )
  return summarizeTemplatePreview(preview)
}

export async function rememberRecentWorkspaceTemplate(root: string, relativePath: string): Promise<void> {
  const normalized = normalizeRelativeTemplatePath(relativePath)
  if (!normalized || pathHasParentDirSegment(normalized)) return
  const config = await readWorkspaceConfig(root)
  const recent = normalizeRecentTemplateList([
    normalized,
    ...(config.templates?.recentlyUsed ?? []),
  ])
  await writeWorkspaceConfig(root, {
    ...config,
    templates: {
      ...config.templates,
      recentlyUsed: recent,
    },
  })
}
