import type { TranslateFn } from '../i18n'

export function humanizeExportError(error: unknown, t: TranslateFn): string {
  const message = error instanceof Error ? error.message : String(error)

  if (/Direct PDF file write is only supported on desktop|desktop app/i.test(message)) {
    return t('app.status.exportNeedDesktop')
  }
  if (/PDF export HTML exceeds|too large/i.test(message)) {
    return t('app.status.exportReasonTooLarge')
  }
  if (/permission denied|operation not permitted|access is denied|forbidden|not allowed/i.test(message)) {
    return t('app.status.exportReasonNoPermission')
  }
  if (/No such file|not found|Failed to read file|Failed to decode export image/i.test(message)) {
    return t('app.status.exportReasonMissingAsset')
  }
  if (/Failed to create raster export frame/i.test(message)) {
    return t('app.status.exportReasonRenderInit')
  }

  return message
}
