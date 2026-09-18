import type { TranslateFn } from '../i18n'
import type { AppStatusTone } from '../app/hooks/useAppStatus'
import { hasExternalDiskDriftInState } from './externalDiskDriftState'

export function hasExternalDiskDriftForPath(
  path: string,
  externalDiskChangedPaths: ReadonlySet<string>,
): boolean {
  return hasExternalDiskDriftInState(path, externalDiskChangedPaths)
}

export function resolveManualSaveStatusFeedback(args: {
  t: TranslateFn
  externalDriftAfterSave?: boolean
  wasHistoryRestorePending?: boolean
}): { message: string; tone: AppStatusTone } {
  if (args.externalDriftAfterSave) {
    const externalHint = args.wasHistoryRestorePending
      ? args.t('app.tabs.externalAria')
      : args.t('app.statusbar.externalChanged')
    return {
      message: `${args.t('app.status.saved')} · ${externalHint}`,
      tone: 'warning',
    }
  }
  return { message: args.t('app.status.saved'), tone: 'success' }
}

export function resolveTabStatusHints(args: {
  t: TranslateFn
  path: string
  historyRestore: boolean
  external: boolean
}): { title: string; ariaStatuses: string[] } {
  if (args.historyRestore && args.external) {
    return {
      title: `${args.t('app.tabs.historyRestoreHint')} · ${args.t('app.tabs.externalDiskHint')}`,
      ariaStatuses: [args.t('app.tabs.historyRestoreAria'), args.t('app.tabs.externalAria')],
    }
  }
  if (args.historyRestore) {
    return {
      title: args.t('app.tabs.historyRestoreHint'),
      ariaStatuses: [args.t('app.tabs.historyRestoreAria')],
    }
  }
  if (args.external) {
    return {
      title: args.t('app.tabs.externalDiskHint'),
      ariaStatuses: [args.t('app.tabs.externalAria')],
    }
  }
  return { title: args.path, ariaStatuses: [] }
}
