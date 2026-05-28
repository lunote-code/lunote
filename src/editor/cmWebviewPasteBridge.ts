import { EditorView } from '@codemirror/view'

import { recordSuccessfulPaste, shouldSkipDuplicatePaste, computePasteFingerprint } from './pasteDedupe'
import {
  applyWebviewPasteFallback,
  extractValidImageFiles,
  htmlFromClipboardData,
  plainTextFromClipboardData,
  type WebviewPasteImageHandler,
} from './webviewPasteBridge'

export function createCmWebviewPasteExtension(onPasteImage?: WebviewPasteImageHandler) {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const cd = event.clipboardData
      const prefetched = plainTextFromClipboardData(cd)
      const prefetchedHtml = htmlFromClipboardData(cd)
      event.preventDefault()
      event.stopPropagation()
      void (async () => {
        const domImages = cd ? await extractValidImageFiles(cd) : []
        const fingerprint = computePasteFingerprint(prefetched, domImages)
        if (shouldSkipDuplicatePaste(fingerprint)) return
        const ok = await applyWebviewPasteFallback({
          cmView: view,
          domImages,
          onPasteImage,
          prefetchedText: prefetched || undefined,
          prefetchedHtml: prefetchedHtml || undefined,
        })
        if (ok && fingerprint) recordSuccessfulPaste(fingerprint)
      })()
      return true
    },
  })
}
