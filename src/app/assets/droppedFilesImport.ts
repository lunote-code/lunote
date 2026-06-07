import type { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'
import type { Editor } from '@tiptap/core'

import type { TranslateFn } from '../../i18n'
import type { AssetStorageConfig } from '../../assets/assetStoragePolicy'
import { createAssetHtmlLink, createAssetMarkdownLink } from '../../assets/markdownLinkTransformer'
import type { AssetMeta } from '../../assets/workspaceAssetStore'
import { insertImageIntoPmView } from '../../editor/webviewPasteBridge'
import { savePastedImageAsset } from './imagePaste'

const IMAGE_NAME_RE = /\.(png|jpe?g|gif|webp|svg|avif|heic|heif|bmp)$/i

export function isDroppedImageFile(file: File): boolean {
  const mime = (file.type || '').toLowerCase()
  if (mime.startsWith('image/')) return true
  return IMAGE_NAME_RE.test(file.name)
}

export function partitionDroppedFiles(files: readonly File[]): { images: File[]; attachments: File[] } {
  const images: File[] = []
  const attachments: File[] = []
  for (const file of files) {
    if (isDroppedImageFile(file)) images.push(file)
    else attachments.push(file)
  }
  return { images, attachments }
}

export function imageAltFromFileName(fileName: string): string {
  const base = fileName.replace(/[/\\]+/u, '').trim() || 'image'
  return base.replace(IMAGE_NAME_RE, '') || base
}

export function buildMarkdownImageSnippet(src: string, alt: string): string {
  const escapedAlt = alt.replace(/\\/gu, '\\\\').replace(/\[/gu, '\\[').replace(/\]/gu, '\\]')
  return `![${escapedAlt}](${src})`
}

export type ApplyDroppedFilesParams = {
  files: readonly File[]
  rootDir: string
  activePath: string
  assetStorage: AssetStorageConfig
  mainPaneMode: 'visual' | 'source'
  getVisualEditor: () => Editor | null
  getSourceView: () => EditorView | null
  importDroppedAssets: (files: File[], options?: { quiet?: boolean }) => Promise<AssetMeta[]>
  setStatus: (msg: string) => void
  t: TranslateFn
}

export type ApplyDroppedFilesResult = {
  imageCount: number
  attachmentCount: number
}

export async function applyDroppedFilesToEditor(params: ApplyDroppedFilesParams): Promise<ApplyDroppedFilesResult> {
  const {
    files,
    rootDir,
    activePath,
    assetStorage,
    mainPaneMode,
    getVisualEditor,
    getSourceView,
    importDroppedAssets,
    setStatus,
    t,
  } = params

  const { images, attachments } = partitionDroppedFiles(files)
  const imageSrcs: Array<{ src: string; alt: string }> = []

  const report = (key: string, vars?: Record<string, string | number>) => setStatus(t(key, vars))

  for (const file of images) {
    const src = await savePastedImageAsset(
      file,
      file.type,
      () => ({ rootDir, activePath, assetStorage }),
      report,
    )
    if (src) {
      imageSrcs.push({ src, alt: imageAltFromFileName(file.name) })
    }
  }

  const assets =
    attachments.length > 0 ? await importDroppedAssets(attachments, { quiet: true }) : []

  if (mainPaneMode === 'visual') {
    const editor = getVisualEditor()
    if (editor && !editor.isDestroyed) {
      const view = editor.view
      for (const { src, alt } of imageSrcs) {
        await insertImageIntoPmView(view, src, alt)
      }
      if (assets.length > 0) {
        const html = assets.map(createAssetHtmlLink).join('<br>')
        editor.chain().focus(undefined, { scrollIntoView: false }).insertContent(html).run()
      }
    }
  } else {
    const view = getSourceView()
    const snippets: string[] = [
      ...imageSrcs.map(({ src, alt }) => buildMarkdownImageSnippet(src, alt)),
      ...assets.map(createAssetMarkdownLink),
    ]
    if (view && snippets.length > 0) {
      const insert = snippets.join('\n')
      const pos = view.state.selection.main.from
      view.dispatch({
        changes: { from: pos, to: pos, insert },
        selection: EditorSelection.cursor(pos + insert.length),
      })
      view.focus()
    }
  }

  const imageCount = imageSrcs.length
  const attachmentCount = assets.length

  if (imageCount > 0 && attachmentCount > 0) {
    setStatus(t('app.drop.importedMixed', { images: imageCount, attachments: attachmentCount }))
  } else if (imageCount > 0) {
    setStatus(t('app.drop.importedImages', { count: imageCount }))
  } else if (attachmentCount > 0) {
    setStatus(t('app.drop.importedCount', { count: attachmentCount }))
  }

  return { imageCount, attachmentCount }
}
