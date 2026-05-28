import { bridgeReplaceSelection } from './editorMutationBridge'
import { recordSuccessfulPaste, shouldSkipDuplicatePaste, computePasteFingerprint } from './pasteDedupe'
import {
  applyWebviewPasteFallback,
  readNavigatorClipboardImageFile,
  readNavigatorClipboardText,
  type WebviewPasteImageHandler,
} from './webviewPasteBridge'
import type { TiptapMarkdownEditorHandle } from './TiptapMarkdownEditor'
import type { EditorView } from '@codemirror/view'

type RefLike<T> = { current: T }

export async function pasteFromNavigatorClipboard(options: {
  plainOnly?: boolean
  onPasteImage?: WebviewPasteImageHandler
  visualEditorRef?: RefLike<TiptapMarkdownEditorHandle | null>
  sourceViewRef?: RefLike<EditorView | null>
  mainPaneMode?: 'visual' | 'source'
}): Promise<boolean> {
  const plainOnly = options.plainOnly ?? false
  const mode = options.mainPaneMode ?? 'visual'

  const textPreview = await readNavigatorClipboardText().catch(() => '')
  let imagePreview: { file: File; mime: string } | null = null
  if (!plainOnly && !textPreview.trim() && options.onPasteImage) {
    imagePreview = await readNavigatorClipboardImageFile()
  }
  const fingerprint = computePasteFingerprint(
    textPreview,
    imagePreview ? [imagePreview.file] : [],
  )
  if (shouldSkipDuplicatePaste(fingerprint)) return false

  if (plainOnly) {
    const text = textPreview || (await readNavigatorClipboardText())
    if (!text) return false
    bridgeReplaceSelection(text)
    if (fingerprint) recordSuccessfulPaste(fingerprint)
    return true
  }

  const pmView =
    mode === 'visual' ? options.visualEditorRef?.current?.getEditor()?.view ?? null : null
  const cmView = mode === 'source' ? options.sourceViewRef?.current ?? null : null

  if (pmView || cmView) {
    const ok = await applyWebviewPasteFallback({
      pmView,
      cmView,
      onPasteImage: options.onPasteImage,
      prefetchedText: textPreview || undefined,
    })
    if (ok && fingerprint) recordSuccessfulPaste(fingerprint)
    return ok
  }

  const text = textPreview || (await readNavigatorClipboardText())
  if (text) {
    bridgeReplaceSelection(text)
    if (fingerprint) recordSuccessfulPaste(fingerprint)
    return true
  }

  if (!options.onPasteImage) return false
  const image = await readNavigatorClipboardImageFile()
  if (!image) return false
  const src = await options.onPasteImage(image.file, image.mime)
  if (!src) return false
  bridgeReplaceSelection(`![](${src})`)
  return true
}
