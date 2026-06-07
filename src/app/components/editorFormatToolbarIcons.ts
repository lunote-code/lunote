import type { SemanticIconName } from '../../design-system/icons'

/** Editor format toolbar: Lucide icons (overrides manifest letter glyphs). */
export const EDITOR_FORMAT_TOOLBAR_ICONS: Record<string, SemanticIconName> = {
  'fmt-bold': 'text-bold',
  'fmt-italic': 'text-italic',
  'fmt-underline': 'text-underline',
  'fmt-inline-code': 'code',
  'fmt-strike': 'text-strike',
  'fmt-highlight': 'text-highlight',
  'fmt-link': 'link',
  'toolbar-callout': 'callout',
}

export function resolveEditorFormatToolbarIcon(commandId: string): SemanticIconName | undefined {
  return EDITOR_FORMAT_TOOLBAR_ICONS[commandId]
}
