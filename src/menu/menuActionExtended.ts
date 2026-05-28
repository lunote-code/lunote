/**
 * `action` ids in the top bar/command panel that have not been itemized in the main `if` chain of `dispatchAppMenuAction`.
 * It is still dispatched uniformly by `dispatchAppMenuAction`. This file only implements branches to avoid the second set of action systems.
 */
import { EditorView } from '@codemirror/view'
import { isTauri } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { getCurrentWindow, PhysicalPosition, PhysicalSize, currentMonitor } from '@tauri-apps/api/window'
import { createAssetMarkdownLink } from '../assets/markdownLinkTransformer'
import { importAsset } from '../assets/assetManager'
import { workspaceIdFromRoot } from '../lunaPersistence'
import {
  EDITOR_FONT_SIZE_MAX,
  EDITOR_FONT_SIZE_MIN,
  resolveEffectiveEditorFontSize,
} from '../settings-runtime/editorTypography'
import { getAssetStorageConfig, getSetting, setSetting } from '../settings-runtime/settingsRuntime'
import { exportBinaryPayload } from '../lib/tauriScopedInvoke'
import { isPathUnderWorkspace, parentDirectoryOfFile, pathsEqual } from '../lib/workspacePathUtils'
import type { AppMenuContext, AppMenuFileTreeNode, AppMenuUiDeps } from './menu.types'
import { redoLastTransaction, undoLastTransaction } from './commandTransaction'
import { bridgeOpenSearchPanel, bridgeReplaceNextInDocument, bridgeRunEditorCommand, bridgeScrollToSelection, bridgeWithSourceView } from '../editor/editorMutationBridge'
import { openLunaEmojiPickerFromSourceView } from '../editor/lunaEmojiPicker'
import { deleteNote, exportBinaryNote, readWorkspaceFileBase64 } from '../platform/tauri/documentService'
import { revealInExplorer, syncViewFullscreenMenuCheckedByHost } from '../platform/tauri/platformShellService'
import { listWorkspaceTree } from '../platform/tauri/workspaceService'


function normalizeLinkForExternalAction(rawHref: string): string | null {
  const trimmed = rawHref.trim()
  if (!trimmed) return null
  const withProtocol = /^www\./iu.test(trimmed) ? `https://${trimmed}` : trimmed
  const lowered = withProtocol.toLowerCase()
  if (
    lowered.startsWith('javascript:') ||
    lowered.startsWith('data:') ||
    lowered.startsWith('vbscript:') ||
    lowered.startsWith('note:') ||
    lowered.startsWith('file:')
  ) {
    return null
  }
  if (/^https?:\/\//iu.test(withProtocol) || /^mailto:/iu.test(withProtocol)) return withProtocol
  return null
}

function extractSelectionLinkHrefFromSource(view: EditorView): string | null {
  const { from, to } = view.state.selection.main
  const selected = view.state.doc.sliceString(from, to).trim()
  if (!selected) return null
  const markdownLink = selected.match(/\[[^\]]*\]\(([^)\s]+(?:\s+"[^"]*")?)\)/u)?.[1]?.trim()
  if (markdownLink) return markdownLink.replace(/\s+".*"$/u, '')
  return selected
}

export type HostWindowActionResult =
  | { ok: true }
  | { ok: false; error: unknown; errorMessage: string }

export type HostFullscreenToggleResult = HostWindowActionResult

function windowActionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return String(error)
}

async function safeWindowHostCall(
  label: string,
  fn: () => Promise<void>,
): Promise<HostWindowActionResult> {
  try {
    await fn()
    return { ok: true }
  } catch (error) {
    const errorMessage = windowActionErrorMessage(error)
    console.error('[WindowAction Error]', label, error)
    return { ok: false, error, errorMessage }
  }
}

async function toggleWebFullscreen(): Promise<HostFullscreenToggleResult> {
  if (typeof document === 'undefined') {
    return { ok: false, error: new Error('document unavailable'), errorMessage: 'document unavailable' }
  }
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await document.documentElement.requestFullscreen()
    }
    return { ok: true }
  } catch (error) {
    const errorMessage = windowActionErrorMessage(error)
    console.error('[WindowAction Error] web-fullscreen', error)
    return { ok: false, error, errorMessage }
  }
}

/** Align the native menu "Full Screen" check state with the actual fullscreen of the window (Tauri desktop package).*/
export async function syncViewFullscreenMenuChecked(): Promise<void> {
  if (!isTauri()) return
  try {
    const checked = await getCurrentWindow().isFullscreen()
    await syncViewFullscreenMenuCheckedByHost(checked)
  } catch (error) {
    console.error('[fullscreen] sync menu checked failed:', error)
  }
}

export async function toggleFullscreenByHostRuntime(): Promise<HostFullscreenToggleResult> {
  try {
    const w = window as typeof window & {
      electronAPI?: { toggleFullscreen?: () => Promise<void> | void }
      api?: { toggleFullscreen?: () => Promise<void> | void }
    }
    const toggle = w.electronAPI?.toggleFullscreen ?? w.api?.toggleFullscreen
    if (typeof toggle === 'function') {
      await toggle()
      return { ok: true }
    }
    if (isTauri()) {
      const win = getCurrentWindow()
      const fs = await win.isFullscreen()
      await win.setFullscreen(!fs)
      await syncViewFullscreenMenuChecked()
      return { ok: true }
    }
    return toggleWebFullscreen()
  } catch (error) {
    const errorMessage = windowActionErrorMessage(error)
    console.error('[WindowAction Error] view-fullscreen', error)
    return { ok: false, error, errorMessage }
  }
}

type MarkdownImageMatch = {
  full: string
  alt: string
  src: string
  title: string | null
  start: number
  end: number
}

type WindowBoundsPreset = 'left-half' | 'right-half' | 'top-half' | 'bottom-half'

type HostWindowApi = {
  minimizeWindow?: () => Promise<void> | void
  toggleMaximizeWindow?: () => Promise<void> | void
  toggleFullscreenWindow?: () => Promise<void> | void
  setFullscreenWindow?: (enabled: boolean) => Promise<void> | void
  setWindowBoundsPreset?: (preset: WindowBoundsPreset) => Promise<void> | void
}

function hostWindowApi(): HostWindowApi {
  const w = window as typeof window & { electronAPI?: HostWindowApi; api?: HostWindowApi }
  return w.electronAPI ?? w.api ?? {}
}

async function minimizeWindowByHostRuntime(): Promise<HostWindowActionResult> {
  const host = hostWindowApi()
  if (typeof host.minimizeWindow === 'function') {
    return safeWindowHostCall('win-minimize-host', async () => {
      await host.minimizeWindow!()
    })
  }
  if (!isTauri()) {
    return { ok: false, error: new Error('not tauri'), errorMessage: 'not tauri' }
  }
  return safeWindowHostCall('win-minimize', async () => {
    await getCurrentWindow().minimize()
  })
}

async function toggleMaximizeWindowByHostRuntime(): Promise<HostWindowActionResult> {
  const host = hostWindowApi()
  if (typeof host.toggleMaximizeWindow === 'function') {
    return safeWindowHostCall('win-zoom-host', async () => {
      await host.toggleMaximizeWindow!()
    })
  }
  if (!isTauri()) {
    return { ok: false, error: new Error('not tauri'), errorMessage: 'not tauri' }
  }
  const win = getCurrentWindow()
  const max = await win.isMaximized()
  if (max) {
    return safeWindowHostCall('win-unmaximize', async () => {
      await win.unmaximize()
    })
  }
  return safeWindowHostCall('win-maximize', async () => {
    await win.maximize()
  })
}

async function setWindowBoundsPresetByHostRuntime(
  preset: WindowBoundsPreset,
  m: AppMenuContext,
): Promise<boolean> {
  const host = hostWindowApi()
  if (typeof host.setWindowBoundsPreset === 'function') {
    await host.setWindowBoundsPreset(preset)
    return true
  }
  if (!isTauri()) return false
  const win = getCurrentWindow()
  const mon = await currentMonitor()
  if (!mon) {
    m.setStatus(m.t('app.ext.noMonitor'))
    return true
  }
  const { position: wp, size: ws } = mon.workArea
  const x = wp.x
  const y = wp.y
  const ww = ws.width
  const wh = ws.height
  let nx = x
  let ny = y
  let nw = ww
  let nh = wh
  if (preset === 'left-half') {
    nw = Math.floor(ww / 2)
  } else if (preset === 'right-half') {
    nx = x + Math.floor(ww / 2)
    nw = Math.ceil(ww / 2)
  } else if (preset === 'top-half') {
    nh = Math.floor(wh / 2)
  } else {
    ny = y + Math.floor(wh / 2)
    nh = Math.ceil(wh / 2)
  }
  await win.setPosition(new PhysicalPosition(nx, ny))
  await win.setSize(new PhysicalSize(nw, nh))
  return true
}

async function toggleWindowFullscreenByHostRuntime(): Promise<HostFullscreenToggleResult> {
  const host = hostWindowApi()
  if (typeof host.toggleFullscreenWindow === 'function') {
    return safeWindowHostCall('win-tile-full-host', async () => {
      await host.toggleFullscreenWindow!()
    })
  }
  if (!isTauri()) {
    return { ok: false, error: new Error('not tauri'), errorMessage: 'not tauri' }
  }
  const result = await safeWindowHostCall('win-tile-full', async () => {
    const win = getCurrentWindow()
    const full = await win.isFullscreen()
    await win.setFullscreen(!full)
    await syncViewFullscreenMenuChecked()
  })
  return result
}

const MD_IMAGE_RE = /!\[([\s\S]*?)\]\(\s*([^)\s]+)\s*(?:\s+"((?:\\.|[^"])*)")?\s*\)/gu
const HTML_IMAGE_RE = /<img\b[^>]*>/giu

function collectMarkdownImages(markdown: string): MarkdownImageMatch[] {
  const out: MarkdownImageMatch[] = []
  for (const m of markdown.matchAll(MD_IMAGE_RE)) {
    const full = m[0] ?? ''
    const start = m.index ?? -1
    if (!full || start < 0) continue
    out.push({
      full,
      alt: m[1] ?? '',
      src: (m[2] ?? '').trim(),
      title: m[3] ?? null,
      start,
      end: start + full.length,
    })
  }
  return out
}

type HtmlImageMatch = {
  full: string
  start: number
  end: number
}

function collectHtmlImageTags(markdown: string): HtmlImageMatch[] {
  const out: HtmlImageMatch[] = []
  for (const m of markdown.matchAll(HTML_IMAGE_RE)) {
    const full = m[0] ?? ''
    const start = m.index ?? -1
    if (!full || start < 0) continue
    out.push({ full, start, end: start + full.length })
  }
  return out
}

function escapeMdAlt(alt: string): string {
  return alt.replace(/\\/gu, '\\\\').replace(/\[/gu, '\\[').replace(/\]/gu, '\\]')
}

function escapeMdTitle(title: string): string {
  return title.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"')
}

function buildMarkdownImage(match: Pick<MarkdownImageMatch, 'alt' | 'src' | 'title'>): string {
  const base = `![${escapeMdAlt(match.alt)}](${match.src})`
  if (match.title && match.title.trim()) return `${base} "${escapeMdTitle(match.title.trim())}"`
  return base
}

function applyReplacements(
  content: string,
  replacements: Array<{ start: number; end: number; text: string }>,
): string {
  if (!replacements.length) return content
  const sorted = [...replacements].sort((a, b) => a.start - b.start)
  let cursor = 0
  let out = ''
  for (const r of sorted) {
    out += content.slice(cursor, r.start)
    out += r.text
    cursor = r.end
  }
  out += content.slice(cursor)
  return out
}

function normalizePath(path: string): string {
  const isAbs = /^[a-zA-Z]:[\\/]/u.test(path) || path.startsWith('/')
  const parts = path.replace(/\\/g, '/').split('/')
  const stack: string[] = []
  for (const p of parts) {
    if (!p || p === '.') continue
    if (p === '..') {
      if (stack.length > 0) stack.pop()
      continue
    }
    stack.push(p)
  }
  if (/^[a-zA-Z]:[\\/]/u.test(path)) {
    const drive = path.slice(0, 2)
    return `${drive}/${stack.slice(1).join('/')}`
  }
  return `${isAbs ? '/' : ''}${stack.join('/')}`
}

function joinPath(baseDir: string, rel: string): string {
  return normalizePath(`${baseDir.replace(/\\/g, '/')}/${rel}`)
}

function basename(path: string): string {
  const p = path.replace(/\\/g, '/')
  const idx = p.lastIndexOf('/')
  return idx >= 0 ? p.slice(idx + 1) : p
}

function findFileNodeByPath(nodes: readonly AppMenuFileTreeNode[], path: string): AppMenuFileTreeNode | null {
  for (const node of nodes) {
    if (node.kind === 'file' && pathsEqual(node.path, path)) return node
    if (node.children?.length) {
      const hit = findFileNodeByPath(node.children, path)
      if (hit) return hit
    }
  }
  return null
}

function formatFileTime(value: number | null | undefined, t: AppMenuContext['t']): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return t('app.menu.filePropUnknown')
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(value))
  } catch {
    return new Date(value).toLocaleString()
  }
}

function extractDocumentIntro(content: string): string {
  const lines = content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  if (lines.length === 0) return ''
  const first = lines[0]
  return first.replace(/^#+\s*/u, '').replace(/[*_`~[\]()>-]/gu, '').trim()
}

function isUnsupportedImageSrc(src: string): boolean {
  const s = src.trim().toLowerCase()
  return (
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('data:') ||
    s.startsWith('luna-asset://')
  )
}

function resolveWorkspaceImagePath(rootDir: string, notePath: string, src: string): string | null {
  if (!rootDir || !notePath) return null
  if (isUnsupportedImageSrc(src)) return null
  const trimmed = src.trim()
  const abs = /^[a-zA-Z]:[\\/]/u.test(trimmed) || trimmed.startsWith('/')
  const resolved = abs ? normalizePath(trimmed) : joinPath(parentDirectoryOfFile(notePath), trimmed)
  return isPathUnderWorkspace(rootDir, resolved) ? resolved : null
}

function fileFromBase64(base64: string, fileName: string, mimeType: string): File {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], fileName, { type: mimeType })
}

function guessImageMime(fileName: string): string {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'svg') return 'image/svg+xml'
  return 'application/octet-stream'
}

function toHtmlImage(match: MarkdownImageMatch, widthPercent?: number): string {
  const widthAttr = widthPercent ? ` width="${widthPercent}%"` : ''
  const titleAttr = match.title && match.title.trim() ? ` title="${match.title.trim()}"` : ''
  const altAttr = match.alt ? ` alt="${match.alt}"` : ' alt=""'
  return `<img src="${match.src}"${altAttr}${titleAttr}${widthAttr} />`
}

function fromHtmlImage(html: string): string | null {
  const src = /src="([^"]+)"/u.exec(html)?.[1]?.trim()
  if (!src) return null
  const alt = /alt="([^"]*)"/u.exec(html)?.[1] ?? ''
  const title = /title="([^"]+)"/u.exec(html)?.[1] ?? null
  return buildMarkdownImage({ alt, src, title })
}

async function updateActiveMarkdown(
  m: AppMenuContext,
  nextContent: string,
  source: string,
): Promise<boolean> {
  if (!m.activePath) return false
  if (nextContent === m.content) return false
  await m.dispatchDocumentCommand({
    type: 'DOCUMENT_CONTENT_CHANGED',
    path: m.activePath,
    content: nextContent,
    source,
  })
  return true
}

function currentSourceSelectionRange(_m: AppMenuContext): { from: number; to: number } | null {
  return bridgeWithSourceView((view) => ({
    from: view.state.selection.main.from,
    to: view.state.selection.main.to,
  }))
}

function preferMatchesBySourceSelection<T extends { start: number; end: number }>(
  m: AppMenuContext,
  matches: T[],
): { matches: T[]; usedSelection: boolean } {
  if (!matches.length) return { matches, usedSelection: false }
  const range = currentSourceSelectionRange(m)
  if (!range) return { matches, usedSelection: false }
  const { from, to } = range
  if (from === to) {
    const hit = matches.find((it) => from >= it.start && from <= it.end)
    if (hit) return { matches: [hit], usedSelection: true }
    return { matches, usedSelection: false }
  }
  const hits = matches.filter((it) => it.end >= from && it.start <= to)
  if (hits.length) return { matches: hits, usedSelection: true }
  return { matches, usedSelection: false }
}

async function uploadLocalImagesFromMarkdown(args: {
  m: AppMenuContext
  onlyFirst: boolean
  deleteOriginal: boolean
  matches?: MarkdownImageMatch[]
}): Promise<{ uploaded: number; deleted: number; failed: number; touched: number }> {
  const { m, onlyFirst, deleteOriginal } = args
  if (!m.rootDir || !m.activePath) return { uploaded: 0, deleted: 0, failed: 0, touched: 0 }
  const matches = args.matches ?? collectMarkdownImages(m.content)
  const replacements: Array<{ start: number; end: number; text: string }> = []
  const toDelete = new Set<string>()
  let uploaded = 0
  let failed = 0
  let touched = 0
  for (const match of matches) {
    const localPath = resolveWorkspaceImagePath(m.rootDir, m.activePath, match.src)
    if (!localPath) continue
    touched += 1
    try {
      const dataBase64 = await readWorkspaceFileBase64(m.rootDir, localPath)
      const name = basename(localPath) || 'image.bin'
      const file = fileFromBase64(dataBase64, name, guessImageMime(name))
      const asset = await importAsset(file, {
        documentPath: m.activePath,
        workspaceRoot: m.rootDir,
        workspaceId: workspaceIdFromRoot(m.rootDir),
        storageConfig: getAssetStorageConfig(),
      })
      replacements.push({ start: match.start, end: match.end, text: createAssetMarkdownLink(asset) })
      if (deleteOriginal) toDelete.add(localPath)
      uploaded += 1
      if (onlyFirst) break
    } catch {
      failed += 1
      if (onlyFirst) break
    }
  }
  const next = applyReplacements(m.content, replacements)
  await updateActiveMarkdown(m, next, deleteOriginal ? 'menu-image-move-all' : 'menu-image-upload')
  let deleted = 0
  if (deleteOriginal && toDelete.size > 0) {
    for (const path of toDelete) {
      try {
        await deleteNote(m.rootDir, path)
        deleted += 1
      } catch {
        /* ignore */
      }
    }
  }
  return { uploaded, deleted, failed, touched }
}

/** @returns true indicates that the action has been consumed*/
export async function tryDispatchExtendedMenuAction(
  action: string,
  m: AppMenuContext,
  ui: AppMenuUiDeps,
): Promise<boolean> {
  switch (action) {
    case 'file-show-intro': {
      if (!m.activePath) {
        m.setStatus(m.t('app.menu.noActiveDocForIntro'))
        return true
      }
      if (m.activePath.startsWith('luna:buf:')) {
        m.setStatus(m.t('app.menu.unnamedTabNotOnDisk'))
        return true
      }
      let fileNode: AppMenuFileTreeNode | null = null
      if (m.rootDir) {
        try {
          const tree = await listWorkspaceTree(m.rootDir)
          fileNode = findFileNodeByPath(tree, m.activePath)
        } catch {
          fileNode = null
        }
      }
      await m.showAppAlert({
        title: m.t('menu.file.showIntro'),
        message:
          `${m.t('app.menu.filePropName')}: ${basename(m.activePath)}\n` +
          `${m.t('app.menu.filePropPath')}: ${m.activePath}\n` +
          `${m.t('app.menu.filePropCreatedAt')}: ${formatFileTime(fileNode?.createdAtMs, m.t)}\n` +
          `${m.t('app.menu.filePropModifiedAt')}: ${formatFileTime(fileNode?.modifiedAtMs, m.t)}\n` +
          `${m.t('app.menu.filePropSummary')}: ${extractDocumentIntro(m.content) || m.t('app.menu.emptyDocIntro')}`,
      })
      return true
    }

    case 'edit-undo': {
      const ok = undoLastTransaction(m.activePath)
      if (!ok) m.setStatus(m.t('app.status.undoUnavailable'))
      return true
    }
    case 'edit-redo': {
      const ok = redoLastTransaction(m.activePath)
      if (!ok) m.setStatus(m.t('app.status.redoUnavailable'))
      return true
    }
    case 'edit-cut':
      await m.cutSelectionToClipboard()
      return true
    case 'edit-copy':
      await m.copySelectionAs('plain')
      m.setStatus(m.t('app.ext.copied'))
      return true
    case 'edit-paste':
      await m.pastePlainFromClipboard()
      return true
    case 'edit-copy-plain':
      await m.copySelectionAs('plain')
      m.setStatus(m.t('app.ext.copiedPlain'))
      return true
    case 'edit-copy-md':
      await m.copySelectionAs('markdown')
      m.setStatus(m.t('app.ext.copiedMd'))
      return true
    case 'edit-copy-html':
      await m.copySelectionAs('html')
      m.setStatus(m.t('app.ext.copiedHtml'))
      return true
    case 'edit-paste-plain':
      await m.pastePlainFromClipboard(true)
      return true
    // edit-select-*, edit-delete-* now handled by COMMAND_RESOLUTION_REGISTRY → Transaction VM
    case 'edit-select-all':
    case 'edit-select-block':
    case 'edit-delete':
    case 'edit-delete-block':
    case 'edit-delete-line':
      console.warn(`[CommandVM] edit command "${action}" bypassed resolver — check pipeline`)
      return true
    case 'edit-eol-crlf':
    case 'edit-eol-lf':
    case 'edit-indent-first-line':
    case 'edit-show-br':
      // runtime:'noop' in manifest — handled by noop-explicit resolver, should not reach here
      return true
    case 'edit-find-prev':
      m.findPreviousInDocument()
      return true
    case 'edit-find-next':
      m.findNextInDocument()
      return true
    case 'edit-find-replace':
      bridgeOpenSearchPanel({ replace: true })
      return true
    case 'edit-replace-next': {
      const ok = bridgeReplaceNextInDocument()
      if (!ok) m.setStatus(m.t('app.menu.findUnavailable'))
      return true
    }
    case 'edit-jump-to-selection':
      bridgeScrollToSelection()
      return true
    case 'edit-emoji':
      bridgeRunEditorCommand({ type: 'openEmojiPicker' }, (view) => {
        openLunaEmojiPickerFromSourceView(view)
        return true
      })
      return true

    // para-* commands are now handled by COMMAND_RESOLUTION_REGISTRY → Transaction VM.
    // These cases are kept as unreachable guards; they should never be reached.
    case 'para-paragraph':
    case 'para-heading-up':
    case 'para-heading-down':
    case 'para-table-row-above':
    case 'para-table-row-below':
    case 'para-math-block':
    case 'para-callout-tip':
    case 'para-callout-suggestion':
    case 'para-callout-important':
    case 'para-callout-warning':
    case 'para-callout-caution':
    case 'para-task-done':
    case 'para-task-undone':
    case 'para-list-indent-more':
    case 'para-list-indent-less':
    case 'para-insert-paragraph-above':
    case 'para-insert-paragraph-below':
    case 'para-link-ref':
    case 'para-footnote':
    case 'para-hr':
    case 'para-toc':
    case 'para-code-copy':
    case 'para-code-tools-indent-selection':
    case 'para-code-tools-indent-block':
      // Should have been consumed by tryExecuteResolvedManifestAction before reaching here
      console.warn(`[CommandVM] para command "${action}" bypassed resolver — check pipeline`)
      return true

    case 'fmt-link-open':
      bridgeRunEditorCommand({ type: 'openLink' }, (view) => {
        const href = normalizeLinkForExternalAction(extractSelectionLinkHrefFromSource(view) ?? '')
        if (!href) {
          m.setStatus(m.t('app.ext.linkNotFoundInSelection'))
          return false
        }
        window.open(href, '_blank', 'noopener,noreferrer')
        return true
      })
      return true
    case 'fmt-link-copy': {
      bridgeRunEditorCommand({ type: 'copyLinkAddress' }, (view) => {
        const url = normalizeLinkForExternalAction(extractSelectionLinkHrefFromSource(view) ?? '')
        if (url) {
          void navigator.clipboard.writeText(url)
          m.setStatus(m.t('app.ext.linkCopied'))
          return true
        }
        m.setStatus(m.t('app.ext.linkNotFoundInSelection'))
        return false
      })
      return true
    }
    case 'fmt-image':
    case 'fmt-image-insert-local':
      await m.insertImagesFromPicker()
      return true
    case 'fmt-image-delete': {
      const images = collectMarkdownImages(m.content)
      if (!images.length) {
        m.setStatus(m.t('app.ext.linkNotFoundInSelection'))
        return true
      }
      const preferred = preferMatchesBySourceSelection(m, images)
      const next = applyReplacements(
        m.content,
        preferred.matches.map((it) => ({ start: it.start, end: it.end, text: '' })),
      )
      await updateActiveMarkdown(m, next, 'menu-image-delete')
      m.setStatus(`Deleted ${preferred.matches.length} image reference(s)${preferred.usedSelection ? ' (from current selection)' : ''}`)
      return true
    }
    case 'fmt-image-as-html': {
      const images = collectMarkdownImages(m.content)
      if (!images.length) {
        m.setStatus('No convertible Markdown images found')
        return true
      }
      const preferred = preferMatchesBySourceSelection(m, images)
      const next = applyReplacements(
        m.content,
        preferred.matches.map((it) => ({
          start: it.start,
          end: it.end,
          text: toHtmlImage(it),
        })),
      )
      await updateActiveMarkdown(m, next, 'menu-image-as-html')
      m.setStatus(`Converted ${preferred.matches.length} image(s) to HTML${preferred.usedSelection ? ' (from current selection)' : ''}`)
      return true
    }
    case 'fmt-image-as-md': {
      const htmlImages = collectHtmlImageTags(m.content)
      if (!htmlImages.length) {
        m.setStatus('No convertible HTML images found')
        return true
      }
      const preferred = preferMatchesBySourceSelection(m, htmlImages)
      const replacements: Array<{ start: number; end: number; text: string }> = []
      for (const hit of preferred.matches) {
        const md = fromHtmlImage(hit.full)
        if (!md) continue
        replacements.push({ start: hit.start, end: hit.end, text: md })
      }
      if (!replacements.length) {
        m.setStatus('HTML image missing src; cannot convert')
        return true
      }
      const next = applyReplacements(m.content, replacements)
      await updateActiveMarkdown(m, next, 'menu-image-as-md')
      m.setStatus(`Converted ${replacements.length} image(s) to Markdown${preferred.usedSelection ? ' (from current selection)' : ''}`)
      return true
    }
    case 'fmt-image-reveal': {
      const preferred = preferMatchesBySourceSelection(m, collectMarkdownImages(m.content))
      const first = preferred.matches.find((img) =>
        resolveWorkspaceImagePath(m.rootDir, m.activePath, img.src))
      if (!first) {
        m.setStatus('No local images found in workspace')
        return true
      }
      const localPath = resolveWorkspaceImagePath(m.rootDir, m.activePath, first.src)
      if (!localPath) {
        m.setStatus('No local images found in workspace')
        return true
      }
      await revealInExplorer(localPath, m.rootDir)
      return true
    }
    case 'fmt-image-copy-all': {
      const images = collectMarkdownImages(m.content)
      if (!images.length) {
        m.setStatus('No image references in this document')
        return true
      }
      await navigator.clipboard.writeText(images.map((it) => it.src).join('\n'))
      m.setStatus(`Copied ${images.length} image URL(s)`)
      return true
    }
    case 'fmt-image-copy-to': {
      if (!isTauri()) {
        m.setStatus(m.t('app.ext.windowLayoutDesktopOnly'))
        return true
      }
      if (!m.rootDir || !m.activePath) {
        m.setStatus('Open a workspace file first')
        return true
      }
      const targetDir = await open({ directory: true, multiple: false, title: 'Choose folder to copy images into' })
      if (!targetDir || Array.isArray(targetDir)) return true
      const preferred = preferMatchesBySourceSelection(m, collectMarkdownImages(m.content))
      const images = preferred.matches
      const copiedNames = new Set<string>()
      let copied = 0
      for (const img of images) {
        const srcPath = resolveWorkspaceImagePath(m.rootDir, m.activePath, img.src)
        if (!srcPath) continue
        try {
          const dataBase64 = await readWorkspaceFileBase64(m.rootDir, srcPath)
          let name = basename(srcPath)
          if (!name) name = `image-${copied + 1}.bin`
          if (copiedNames.has(name)) {
            const dot = name.lastIndexOf('.')
            const stem = dot > 0 ? name.slice(0, dot) : name
            const ext = dot > 0 ? name.slice(dot) : ''
            let i = 1
            while (copiedNames.has(`${stem}-${i}${ext}`)) i += 1
            name = `${stem}-${i}${ext}`
          }
          copiedNames.add(name)
          await exportBinaryNote(exportBinaryPayload(
            `${String(targetDir).replace(/[/\\]+$/u, '')}/${name}`,
            dataBase64,
            m.rootDir,
          ))
          copied += 1
        } catch {
          /* ignore */
        }
      }
      m.setStatus(
        copied > 0
          ? `Copied ${copied} image(s) to target folder${preferred.usedSelection ? ' (from current selection)' : ''}`
          : 'No local images to copy',
      )
      return true
    }
    case 'fmt-image-upload': {
      const preferred = preferMatchesBySourceSelection(m, collectMarkdownImages(m.content))
      const r = await uploadLocalImagesFromMarkdown({
        m,
        onlyFirst: true,
        deleteOriginal: false,
        matches: preferred.matches,
      })
      if (r.uploaded > 0) m.setStatus(`Uploaded ${r.uploaded} image(s) and updated references${preferred.usedSelection ? ' (from current selection)' : ''}`)
      else m.setStatus(r.touched > 0 ? 'Upload failed; check file permissions or settings' : 'No local images to upload')
      return true
    }
    case 'fmt-image-upload-all-local': {
      const preferred = preferMatchesBySourceSelection(m, collectMarkdownImages(m.content))
      const r = await uploadLocalImagesFromMarkdown({
        m,
        onlyFirst: false,
        deleteOriginal: false,
        matches: preferred.matches,
      })
      if (r.uploaded > 0) m.setStatus(`Uploaded ${r.uploaded} image(s)${r.failed ? `, failed ${r.failed}` : ''}${preferred.usedSelection ? ' (from current selection)' : ''}`)
      else m.setStatus(r.touched > 0 ? 'Upload failed; check file permissions or settings' : 'No local images to upload')
      return true
    }
    case 'fmt-image-move-all': {
      const preferred = preferMatchesBySourceSelection(m, collectMarkdownImages(m.content))
      const r = await uploadLocalImagesFromMarkdown({
        m,
        onlyFirst: false,
        deleteOriginal: true,
        matches: preferred.matches,
      })
      if (r.uploaded > 0) {
        m.setStatus(`Moved ${r.uploaded} image(s) to asset library${r.deleted ? `, deleted ${r.deleted} source file(s)` : ''}${preferred.usedSelection ? ' (from current selection)' : ''}`)
      } else {
        m.setStatus(r.touched > 0 ? 'Move failed; check file permissions or settings' : 'No local images to move')
      }
      return true
    }
    case 'fmt-image-reload-all': {
      const preferred = preferMatchesBySourceSelection(m, collectMarkdownImages(m.content))
      const images = preferred.matches
      if (!images.length) {
        m.setStatus('No image references in this document')
        return true
      }
      const stamp = Date.now()
      const replacements = images.map((img) => {
        const src = img.src
        const hashIdx = src.indexOf('#')
        const hash = hashIdx >= 0 ? src.slice(hashIdx) : ''
        const base = hashIdx >= 0 ? src.slice(0, hashIdx) : src
        const sep = base.includes('?') ? '&' : '?'
        const bumped = `${base}${sep}luna_reload=${stamp}${hash}`
        return { start: img.start, end: img.end, text: buildMarkdownImage({ ...img, src: bumped }) }
      })
      const next = applyReplacements(m.content, replacements)
      await updateActiveMarkdown(m, next, 'menu-image-reload-all')
      m.setStatus(`Reloaded ${images.length} image reference(s)${preferred.usedSelection ? ' (from current selection)' : ''}`)
      return true
    }
    case 'fmt-image-on-insert-copy':
      await setSetting('assets.storage.mode', 'relative_to_document')
      m.setStatus('Set: copy images into document assets folder on insert')
      return true
    case 'fmt-image-on-insert-upload':
      await setSetting('assets.storage.mode', 'absolute_path')
      m.setStatus('Set: upload images to global assets folder on insert')
      return true
    case 'fmt-image-root-dir': {
      const picked = await open({ directory: true, multiple: false, title: 'Choose global assets folder' })
      if (!picked || Array.isArray(picked)) return true
      await setSetting('assets.absolute.path', String(picked))
      await setSetting('assets.storage.mode', 'absolute_path')
      m.setStatus('Global assets folder updated')
      return true
    }
    case 'fmt-image-global-settings':
      ui.openPreferencesDialog()
      return true
    case 'view-word-count': {
      ui.setStatusbarVisible((v) => !v)
      m.setStatus(m.t('menu.view.wordCount'))
      return true
    }
    case 'view-zoom-in': {
      const cur = resolveEffectiveEditorFontSize(getSetting('editor.fontSize'))
      const next = Math.min(EDITOR_FONT_SIZE_MAX, cur + 1)
      void setSetting('editor.fontSize', String(next))
      return true
    }
    case 'view-zoom-out': {
      const cur = resolveEffectiveEditorFontSize(getSetting('editor.fontSize'))
      const next = Math.max(EDITOR_FONT_SIZE_MIN, cur - 1)
      void setSetting('editor.fontSize', String(next))
      return true
    }
    case 'view-fullscreen': {
      const result = await toggleFullscreenByHostRuntime()
      if (!result.ok) {
        const message = result.errorMessage.trim()
        m.setStatus(
          isTauri()
            ? m.t('app.ext.fullscreenFailed', { message })
            : m.t('app.ext.fullscreenBrowserHint'),
        )
      }
      return true
    }

    case 'win-minimize': {
      console.log('[WindowAction]', action)
      const result = await minimizeWindowByHostRuntime()
      if (!result.ok) {
        m.setStatus(
          isTauri()
            ? m.t('app.ext.windowMinimizeFailed', { message: result.errorMessage })
            : m.t('app.ext.minimizeDesktopOnly'),
        )
      }
      return true
    }
    case 'win-zoom': {
      console.log('[WindowAction]', action)
      const result = await toggleMaximizeWindowByHostRuntime()
      if (!result.ok) {
        m.setStatus(
          isTauri()
            ? m.t('app.ext.windowZoomFailed', { message: result.errorMessage })
            : m.t('app.ext.zoomDesktopOnly'),
        )
      }
      return true
    }
    case 'win-move-resize-half-left':
      if (!(await setWindowBoundsPresetByHostRuntime('left-half', m))) m.setStatus(m.t('app.ext.windowLayoutDesktopOnly'))
      return true
    case 'win-move-resize-half-right':
      if (!(await setWindowBoundsPresetByHostRuntime('right-half', m))) m.setStatus(m.t('app.ext.windowLayoutDesktopOnly'))
      return true
    case 'win-move-resize-half-top':
      if (!(await setWindowBoundsPresetByHostRuntime('top-half', m))) m.setStatus(m.t('app.ext.windowLayoutDesktopOnly'))
      return true
    case 'win-move-resize-half-bottom':
      if (!(await setWindowBoundsPresetByHostRuntime('bottom-half', m))) m.setStatus(m.t('app.ext.windowLayoutDesktopOnly'))
      return true
    case 'win-tile-full': {
      console.log('[WindowAction]', action)
      const result = await toggleWindowFullscreenByHostRuntime()
      if (!result.ok) {
        m.setStatus(
          isTauri()
            ? m.t('app.ext.fullscreenFailed', { message: result.errorMessage })
            : m.t('app.ext.tileDesktopOnly'),
        )
      }
      return true
    }

    default:
      break
  }

  if (action.startsWith('fmt-image-zoom-')) {
    const ratio = Number(action.slice('fmt-image-zoom-'.length))
    if (!Number.isFinite(ratio) || ratio <= 0) return true
    const images = collectMarkdownImages(m.content)
    if (!images.length) {
      m.setStatus('No image references in this document')
      return true
    }
    const preferred = preferMatchesBySourceSelection(m, images)
    const next = applyReplacements(
      m.content,
      preferred.matches.map((img) => ({
        start: img.start,
        end: img.end,
        text: toHtmlImage(img, ratio),
      })),
    )
    await updateActiveMarkdown(m, next, 'menu-image-zoom')
    m.setStatus(`Scaled ${preferred.matches.length} image(s) to ${ratio}%${preferred.usedSelection ? ' (from current selection)' : ''}`)
    return true
  }

  return false
}
