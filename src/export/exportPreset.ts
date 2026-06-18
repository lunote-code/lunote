import { getAppSettingsSnapshot } from '../settings/appSettingsStore'

export type ExportPresetId = 'print-a4' | 'compact-a4' | 'share-wide' | 'letter'
export type ExportTocMode = 'marker-only' | 'always' | 'off'
export type ExportPageBreakMode = 'avoid-blocks' | 'flow'

export type ExportPresetConfig = {
  id: ExportPresetId
  pageSize: string
  pageMargin: string
  contentWidthPx: number
}

export type ExportSettingsSnapshot = {
  presetId: ExportPresetId
  tocMode: ExportTocMode
  pageBreakMode: ExportPageBreakMode
  preset: ExportPresetConfig
}

export const EXPORT_PRESET_OPTIONS: readonly ExportPresetConfig[] = [
  {
    id: 'print-a4',
    pageSize: 'A4',
    pageMargin: '18mm 14mm',
    contentWidthPx: 860,
  },
  {
    id: 'compact-a4',
    pageSize: 'A4',
    pageMargin: '12mm 10mm',
    contentWidthPx: 920,
  },
  {
    id: 'share-wide',
    pageSize: 'A4',
    pageMargin: '10mm 10mm',
    contentWidthPx: 1040,
  },
  {
    id: 'letter',
    pageSize: 'Letter',
    pageMargin: '0.7in 0.65in',
    contentWidthPx: 880,
  },
] as const

export function normalizeExportPresetId(value: unknown): ExportPresetId {
  return value === 'compact-a4' || value === 'share-wide' || value === 'letter' ? value : 'print-a4'
}

export function normalizeExportTocMode(value: unknown): ExportTocMode {
  return value === 'always' || value === 'off' ? value : 'marker-only'
}

export function normalizeExportPageBreakMode(value: unknown): ExportPageBreakMode {
  return value === 'flow' ? 'flow' : 'avoid-blocks'
}

export function resolveExportPresetConfig(id: ExportPresetId): ExportPresetConfig {
  return EXPORT_PRESET_OPTIONS.find((entry) => entry.id === id) ?? EXPORT_PRESET_OPTIONS[0]
}

export function resolveCurrentExportSettings(): ExportSettingsSnapshot {
  const snapshot = getAppSettingsSnapshot()
  const presetId = normalizeExportPresetId(snapshot.appearance?.export?.preset)
  const tocMode = normalizeExportTocMode(snapshot.appearance?.export?.tocMode)
  const pageBreakMode = normalizeExportPageBreakMode(snapshot.appearance?.export?.pageBreakMode)
  return {
    presetId,
    tocMode,
    pageBreakMode,
    preset: resolveExportPresetConfig(presetId),
  }
}

export function buildExportLayoutCss(settings: ExportSettingsSnapshot): string {
  return `
.markdown-body.markdown-export-body {
  max-width: ${settings.preset.contentWidthPx}px;
  margin-left: auto;
  margin-right: auto;
}
`.trim()
}
