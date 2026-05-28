import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'

import { recordSuccessfulPaste, shouldSkipDuplicatePaste, computePasteFingerprint } from '../pasteDedupe'
import {
  applyWebviewPasteFallback,
  extractValidImageFiles,
  htmlFromClipboardData,
  plainTextFromClipboardData,
  type WebviewPasteImageHandler,
} from '../webviewPasteBridge'

export type LunaWebviewPasteBridgeOptions = {
  onPasteImage?: WebviewPasteImageHandler
}

/**
 * Paste in the editor uses the plain text/image pipeline (`inputLayerSource: paste`).
 * Both the browser and Tauri block PM's native rich text pasting.
 */
export const LunaWebviewPasteBridge = Extension.create<LunaWebviewPasteBridgeOptions>({
  name: 'lunaWebviewPasteBridge',
  priority: 1000,
  addOptions() {
    return { onPasteImage: undefined }
  },
  addProseMirrorPlugins() {
    const onPasteImage = this.options.onPasteImage
    return [
      new Plugin({
        props: {
          handlePaste: (view, event) => {
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
                pmView: view,
                domImages,
                onPasteImage,
                prefetchedText: prefetched || undefined,
                prefetchedHtml: prefetchedHtml || undefined,
              })
              if (ok && fingerprint) recordSuccessfulPaste(fingerprint)
            })()
            return true
          },
        },
      }),
    ]
  },
})
