import {
  resolveEditorOverlayChrome,
  resolveEditorPersistentStatusMessage,
  shouldMountDocumentEditor,
  shouldShowDocumentLoadingOverlay,
} from './editorRestoreExternalChrome'
import { filterAutosaveEligibleDirtyPaths } from './autosavePathEligibility'

type Case = {
  readonly name: string
  readonly run: () => void
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`)
  }
}

const t = (key: string, vars?: Record<string, string | number>) =>
  vars ? `${key}:${JSON.stringify(vars)}` : key

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'history plus external hides external reload CTA in statusbar',
    run: () => {
      const chrome = resolveEditorOverlayChrome({
        statusbarVisible: true,
        historyRestorePending: true,
        externalDrift: true,
      })
      assert(chrome.showBothRestoreAndExternal, 'should mark combined state')
      assert(chrome.showHistorySaveCta, 'should keep history save CTA')
      assert(!chrome.showExternalReloadCta, 'should hide external reload while history pending')
      assert(!chrome.showExternalChangedBanner, 'external-only banner should stay hidden')
    },
  },
  {
    name: 'history save clears chrome and restores external reload when drift remains',
    run: () => {
      const afterHistorySave = resolveEditorOverlayChrome({
        statusbarVisible: true,
        historyRestorePending: false,
        externalDrift: true,
      })
      assert(!afterHistorySave.showHistorySaveCta, 'history save should clear history CTA')
      assert(afterHistorySave.showExternalReloadCta, 'external reload should return when drift remains')
    },
  },
  {
    name: 'combined statusbar copy uses short aria hints',
    run: () => {
      const message = resolveEditorPersistentStatusMessage({
        t,
        statusbarVisible: true,
        historyRestorePending: true,
        externalDrift: true,
        dirty: true,
        workspaceLoadingLabelKey: null,
        savedAt: '',
      })
      assert(message.includes('app.tabs.historyRestoreAria'), 'should include history aria')
      assert(message.includes('app.tabs.externalAria'), 'should include external aria')
    },
  },
  {
    name: 'workspace open overlay stays up without mounting the editor',
    run: () => {
      assert(
        shouldShowDocumentLoadingOverlay({
          workspaceLoading: true,
          documentLoading: false,
          showEmptyState: false,
        }),
        'restored tabs must still show opening overlay',
      )
      assert(
        shouldShowDocumentLoadingOverlay({
          workspaceLoading: true,
          documentLoading: false,
          showEmptyState: true,
        }),
        'opening overlay must show even before tabs exist',
      )
      assert(
        !shouldMountDocumentEditor({ workspaceLoading: true, showEmptyState: false }),
        'must not mount TipTap while the initial document is still opening',
      )
    },
  },
  {
    name: 'ready workspace mounts the editor and hides the opening overlay',
    run: () => {
      assert(
        shouldMountDocumentEditor({ workspaceLoading: false, showEmptyState: false }),
        'ready document pane must mount the editor',
      )
      assert(
        !shouldShowDocumentLoadingOverlay({
          workspaceLoading: false,
          documentLoading: false,
          showEmptyState: false,
        }),
        'ready document pane must not keep the opening overlay',
      )
    },
  },
  {
    name: 'later document load keeps the editor mounted under the overlay',
    run: () => {
      assert(
        shouldMountDocumentEditor({ workspaceLoading: false, showEmptyState: false }),
        'tab switches must not unmount the editor',
      )
      assert(
        shouldShowDocumentLoadingOverlay({
          workspaceLoading: false,
          documentLoading: true,
          showEmptyState: false,
        }),
        'tab-switch overlay must still show',
      )
    },
  },
  {
    name: 'workspace restore hang class: overlay until ready, then editor, never both stuck',
    run: () => {
      const opening = {
        workspaceLoading: true,
        documentLoading: false,
        showEmptyState: false,
      }
      assert(shouldShowDocumentLoadingOverlay(opening), 'opening must show overlay')
      assert(
        !shouldMountDocumentEditor({ workspaceLoading: true, showEmptyState: false }),
        'opening must not mount TipTap over in-flight read_note',
      )
      const ready = {
        workspaceLoading: false,
        documentLoading: false,
        showEmptyState: false,
      }
      assert(shouldMountDocumentEditor({ workspaceLoading: false, showEmptyState: false }), 'ready must mount editor')
      assert(!shouldShowDocumentLoadingOverlay(ready), 'ready must drop overlay so content can appear')
    },
  },
  {
    name: 'autosave skips history suspended dirty paths',
    run: () => {
      const suspended = new Set(['/vault/history.md'])
      const eligible = filterAutosaveEligibleDirtyPaths(
        ['/vault/history.md', '/vault/live.md', 'buffer-1'],
        (path) => path.startsWith('buffer-'),
        (path) => suspended.has(path),
      )
      assertEqual(eligible.length, 1, 'only unsuspended workspace path should remain')
      assertEqual(eligible[0], '/vault/live.md', 'should keep live dirty path')
    },
  },
])

export async function assertEditorRestoreExternalChromeSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0

  for (const testCase of CASES) {
    try {
      testCase.run()
      passed += 1
    } catch (error) {
      failed += 1
      console.error(`[editorRestoreExternalChrome] ${testCase.name}:`, error)
    }
  }

  return { passed, failed }
}
