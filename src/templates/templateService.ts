import { dispatchDocumentCommand } from '../documentRuntime/documentKernel'
import { joinRelativePath, pathHasParentDirSegment, relativePathUnderRoot } from '../lib/workspacePathUtils'
import { readNote, saveNote } from '../platform/tauri/documentService'
import { revealInExplorer } from '../platform/tauri/platformShellService'
import { createWorkspaceFolder } from '../platform/tauri/workspaceService'
import {
  readWorkspaceConfig,
  vaultFolderName,
  workspaceConfigAbsolutePath,
} from '../workspace/workspaceConfig'
import type { WorkspaceConfig } from '../workspace/workspaceConfigTypes'
import {
  buildDefaultNoteContent,
  getDefaultDailyTemplate,
  getDefaultNewNoteTemplate,
} from './defaultNoteContent'
import { resolveTemplateLocale } from './templateLocale'
import { renderTemplateString, type TemplateRenderContext } from './renderTemplate'

export type WorkspaceTemplateKind = 'defaultNewNote' | 'dailyNote'

function normalizeTemplateRelPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/u, '').trim()
}

function getTemplateRefs(config: WorkspaceConfig) {
  return {
    templatesFolder: normalizeTemplateRelPath(config.templates?.folder ?? 'Templates'),
    defaultTemplate: normalizeTemplateRelPath(config.templates?.defaultNewNote ?? 'Templates/Default.md'),
    dailyTemplate: normalizeTemplateRelPath(config.dailyNotes?.template ?? 'Templates/Daily.md'),
  }
}

export async function loadTemplateContent(root: string, templateRelPath: string): Promise<string | null> {
  const rel = normalizeTemplateRelPath(templateRelPath)
  if (!rel || pathHasParentDirSegment(rel)) return null
  try {
    return await readNote(root, rel)
  } catch {
    return null
  }
}

export function buildTemplateContext(options: {
  title: string
  filename: string
  folder?: string
  root: string
  now?: Date
}): TemplateRenderContext {
  return {
    title: options.title,
    filename: options.filename,
    folder: options.folder,
    vaultName: vaultFolderName(options.root),
    now: options.now,
  }
}

export async function renderNoteFromTemplate(
  root: string,
  templateRelPath: string | undefined,
  ctx: TemplateRenderContext,
): Promise<string> {
  if (templateRelPath?.trim()) {
    const raw = await loadTemplateContent(root, templateRelPath)
    if (raw != null) return renderTemplateString(raw, ctx)
  }
  return buildDefaultNoteContent(ctx.title, resolveTemplateLocale())
}

async function ensureParentDirs(root: string, relativeFilePath: string): Promise<void> {
  const rel = normalizeTemplateRelPath(relativeFilePath)
  const slash = rel.lastIndexOf('/')
  if (slash <= 0) return
  const parentRel = rel.slice(0, slash)
  const parts = parentRel.split('/').filter(Boolean)
  let current = root
  for (const part of parts) {
    const nextParent = joinRelativePath(current, part)
    try {
      await createWorkspaceFolder(root, current, part)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!/already exists|exist/i.test(msg)) throw e
    }
    current = nextParent
  }
}

export async function ensureDefaultTemplateFiles(root: string, config?: WorkspaceConfig): Promise<void> {
  const cfg = config ?? (await readWorkspaceConfig(root))
  const { templatesFolder, dailyTemplate: dailyPath, defaultTemplate: defaultPath } = getTemplateRefs(cfg)

  if (templatesFolder && !pathHasParentDirSegment(templatesFolder)) {
    try {
      await createWorkspaceFolder(root, root, templatesFolder)
    } catch {
      /* folder may exist */
    }
  }

  const locale = resolveTemplateLocale()
  for (const [rel, body] of [
    [dailyPath, getDefaultDailyTemplate(locale)],
    [defaultPath, getDefaultNewNoteTemplate(locale)],
  ] as const) {
    if (!rel || pathHasParentDirSegment(rel)) continue
    try {
      await readNote(root, rel)
    } catch {
      await ensureParentDirs(root, rel)
      await saveNote(root, rel, body, { forceOverwrite: true })
    }
  }
}

export async function resolveNewNoteContent(
  root: string,
  options: { stem: string; parentPath: string; templatePath?: string },
): Promise<string> {
  const config = await readWorkspaceConfig(root)
  const templatePath = options.templatePath?.trim() || config.templates?.defaultNewNote
  const parentRel = relativePathUnderRoot(root, options.parentPath) ?? ''
  const filename = options.stem.replace(/\.md$/i, '')
  const ctx = buildTemplateContext({
    root,
    title: filename,
    filename,
    folder: parentRel || undefined,
  })
  return renderNoteFromTemplate(root, templatePath, ctx)
}

export function dailyNoteAbsolutePath(root: string, relativePath: string): string {
  return workspaceConfigAbsolutePath(root, relativePath)
}

export async function resolveWorkspaceTemplatePath(
  root: string,
  kind: WorkspaceTemplateKind,
): Promise<string> {
  const config = await readWorkspaceConfig(root)
  await ensureDefaultTemplateFiles(root, config)
  const refs = getTemplateRefs(config)
  const rel = kind === 'dailyNote' ? refs.dailyTemplate : refs.defaultTemplate
  return joinRelativePath(root, rel)
}

export async function openWorkspaceTemplateDocument(
  root: string,
  kind: WorkspaceTemplateKind,
  openInTab = true,
): Promise<string> {
  const path = await resolveWorkspaceTemplatePath(root, kind)
  await dispatchDocumentCommand({
    type: openInTab ? 'OPEN_DOCUMENT_IN_TAB' : 'OPEN_DOCUMENT',
    root,
    path,
    source: 'template',
  })
  return path
}

export async function openTemplateDocumentByPath(
  root: string,
  relativePath: string,
  openInTab = true,
): Promise<string> {
  const rel = normalizeTemplateRelPath(relativePath)
  if (!rel || pathHasParentDirSegment(rel)) throw new Error('Invalid template path')
  const path = joinRelativePath(root, rel)
  await dispatchDocumentCommand({
    type: openInTab ? 'OPEN_DOCUMENT_IN_TAB' : 'OPEN_DOCUMENT',
    root,
    path,
    source: 'template',
  })
  return path
}

export async function revealWorkspaceTemplatesFolder(root: string): Promise<string> {
  const config = await readWorkspaceConfig(root)
  await ensureDefaultTemplateFiles(root, config)
  const { templatesFolder } = getTemplateRefs(config)
  const folderPath = joinRelativePath(root, templatesFolder || 'Templates')
  await revealInExplorer(folderPath, root)
  return folderPath
}

export async function revealWorkspaceTemplateFile(root: string, relativePath: string): Promise<string> {
  const rel = normalizeTemplateRelPath(relativePath)
  if (!rel || pathHasParentDirSegment(rel)) throw new Error('Invalid template path')
  const filePath = joinRelativePath(root, rel)
  await revealInExplorer(filePath, root)
  return filePath
}
