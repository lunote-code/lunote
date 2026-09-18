import type { TranslateFn } from '../i18n'

export type EditorOverlayChromeInput = {
  statusbarVisible: boolean
  historyRestorePending: boolean
  externalDrift: boolean
}

export function resolveEditorOverlayChrome(input: EditorOverlayChromeInput) {
  const showBothRestoreAndExternal = input.historyRestorePending && input.externalDrift
  return {
    showBothRestoreAndExternal,
    showHistoryRestoreBanner: input.historyRestorePending && !input.statusbarVisible,
    showExternalChangedBanner:
      input.externalDrift && !input.statusbarVisible && !input.historyRestorePending,
    showHistorySaveCta: input.historyRestorePending,
    showExternalReloadCta: input.externalDrift && !input.historyRestorePending,
  }
}

export function resolveEditorPersistentStatusMessage(args: {
  t: TranslateFn
  statusbarVisible: boolean
  historyRestorePending: boolean
  externalDrift: boolean
  dirty: boolean
  workspaceLoadingLabelKey: string | null
  savedAt: string
}): string {
  const chrome = resolveEditorOverlayChrome({
    statusbarVisible: args.statusbarVisible,
    historyRestorePending: args.historyRestorePending,
    externalDrift: args.externalDrift,
  })

  if (args.historyRestorePending) {
    if (args.statusbarVisible) {
      return chrome.showBothRestoreAndExternal
        ? `${args.t('app.tabs.historyRestoreAria')} · ${args.t('app.tabs.externalAria')}`
        : args.t('app.tabs.historyRestoreAria')
    }
    return chrome.showBothRestoreAndExternal
      ? `${args.t('app.history.banner')} · ${args.t('app.tabs.externalAria')}`
      : args.t('app.history.banner')
  }

  if (args.externalDrift) {
    return args.statusbarVisible
      ? args.t('app.tabs.externalAria')
      : args.t('app.statusbar.externalChanged')
  }

  if (args.dirty) return args.t('app.statusbar.unsaved')
  if (args.workspaceLoadingLabelKey) return args.t(args.workspaceLoadingLabelKey)
  if (args.savedAt) return args.t('app.search.savedAt', { time: args.savedAt })
  return args.t('app.statusbar.ready')
}
