import type { SemanticIconName } from '../../design-system/icons/iconRegistry'

/** Leading tab icon aligned with workspace sidebar file chrome (`note` for markdown). */
export function resolveEditorTabIcon(path: string): SemanticIconName {
  const fileName = path.replace(/\\/g, '/').split('/').pop() ?? path
  const dot = fileName.lastIndexOf('.')
  const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : ''

  if (ext === 'md' || ext === 'markdown') return 'note'
  return 'files'
}
