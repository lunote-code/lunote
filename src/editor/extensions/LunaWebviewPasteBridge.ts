import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'

import { getFocusedCodeBlockCmView, isCodeBlockCmFocused } from '../codeBlock/cm/codeBlockCmFocus'
import { recordSuccessfulPaste, shouldSkipDuplicatePaste, computePasteFingerprint } from '../pasteDedupe'
import {
  debugPasteScroll,
  logPasteScrollPhase,
  startPasteScrollTrace,
} from '../pasteScrollDebug'
import {
  applyWebviewPasteFallback,
  extractValidImageFiles,
  htmlFromClipboardData,
  plainTextFromClipboardData,
  allowNavigatorClipboardReadForPasteEvent,
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
            const codeBlockCm =
              isCodeBlockCmFocused() ? getFocusedCodeBlockCmView() : null
            if (codeBlockCm) {
              event.preventDefault()
              event.stopPropagation()
              void (async () => {
                const fingerprint = computePasteFingerprint(prefetched, [])
                if (shouldSkipDuplicatePaste(fingerprint)) return
                const ok = await applyWebviewPasteFallback({
                  cmView: codeBlockCm,
                  prefetchedText: prefetched,
                  prefetchedHtml: prefetchedHtml || undefined,
                  allowNavigatorClipboardRead: allowNavigatorClipboardReadForPasteEvent(event),
                })
                if (ok && fingerprint) recordSuccessfulPaste(fingerprint)
              })()
              return true
            }
            const selectionAtEvent = {
              from: view.state.selection.from,
              to: view.state.selection.to,
            }
            startPasteScrollTrace({
              source: 'native-paste-event',
              pmView: view,
              context: {
                prefetchedLength: prefetched.length,
                hasHtml: Boolean(prefetchedHtml),
                selectionAtEvent,
              },
            })
            logPasteScrollPhase('handlePaste-sync', {
              pmView: view,
              selectionAtEvent,
              prefetchedPreview: prefetched.slice(0, 80),
            })
            event.preventDefault()
            event.stopPropagation()
            void (async () => {
              const asyncStartSelection = {
                from: view.state.selection.from,
                to: view.state.selection.to,
              }
              logPasteScrollPhase('handlePaste-async-start', {
                pmView: view,
                selectionAtEvent,
                asyncStartSelection,
                selectionDrift:
                  asyncStartSelection.from !== selectionAtEvent.from ||
                  asyncStartSelection.to !== selectionAtEvent.to,
              })
              const domImages = cd ? await extractValidImageFiles(cd) : []
              const fingerprint = computePasteFingerprint(prefetched, domImages)
              if (shouldSkipDuplicatePaste(fingerprint)) {
                debugPasteScroll('handlePaste-skipped-duplicate', { fingerprint })
                return
              }
              const ok = await applyWebviewPasteFallback({
                pmView: view,
                domImages,
                onPasteImage,
                prefetchedText: prefetched,
                prefetchedHtml: prefetchedHtml || undefined,
                allowNavigatorClipboardRead: allowNavigatorClipboardReadForPasteEvent(event),
              })
              logPasteScrollPhase('handlePaste-async-done', {
                pmView: view,
                ok,
                selectionAtEvent,
                asyncStartSelection,
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
