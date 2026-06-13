import { isTauri } from '@tauri-apps/api/core'
import type { EditorView } from '@codemirror/view'

import { getFocusedCodeBlockCmView, isCodeBlockCmFocused } from './codeBlock/cm/codeBlockCmFocus'
import { bridgeReplaceSelection } from './editorMutationBridge'
import { recordSuccessfulPaste, shouldSkipDuplicatePaste, computePasteFingerprint } from './pasteDedupe'
import { debugPasteScroll, logPasteScrollPhase, startPasteScrollTrace } from './pasteScrollDebug'
import type { TiptapMarkdownEditorHandle } from './TiptapMarkdownEditor'
import {
  applyWebviewPasteFallback,
  readNavigatorClipboardImageFile,
  readNavigatorClipboardText,
  type WebviewPasteImageHandler,
} from './webviewPasteBridge'
import { isNonEditorTextInputTarget, pasteIntoFocusedNativeTextInput } from './webviewPasteFocus'

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

  if (isNonEditorTextInputTarget()) {
    return pasteIntoFocusedNativeTextInput()
  }

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

  let pmView =
    mode === 'visual' ? options.visualEditorRef?.current?.getEditor()?.view ?? null : null
  let cmView = mode === 'source' ? options.sourceViewRef?.current ?? null : null

  if (mode === 'visual' && isCodeBlockCmFocused()) {
    const codeBlockCm = getFocusedCodeBlockCmView()
    if (codeBlockCm) {
      pmView = null
      cmView = codeBlockCm
    }
  }

  if (pmView || cmView) {
    startPasteScrollTrace({
      source: plainOnly ? 'menu-paste-plain' : 'menu-paste',
      pmView,
      context: { mode, plainOnly, textPreviewLength: textPreview.length },
    })
    logPasteScrollPhase('pasteFromNavigatorClipboard-start', { pmView, mode, plainOnly })
    const ok = await applyWebviewPasteFallback({
      pmView,
      cmView,
      onPasteImage: options.onPasteImage,
      prefetchedText: textPreview || undefined,
      allowNavigatorClipboardRead: !isTauri(),
    })
    logPasteScrollPhase('pasteFromNavigatorClipboard-done', { pmView, ok })
    if (ok && fingerprint) recordSuccessfulPaste(fingerprint)
    return ok
  }

  const text = textPreview || (await readNavigatorClipboardText())
  if (text) {
    debugPasteScroll('pasteFromNavigatorClipboard-bridge-replace', { textLength: text.length })
    startPasteScrollTrace({ source: 'bridge-replace', context: { textLength: text.length } })
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
