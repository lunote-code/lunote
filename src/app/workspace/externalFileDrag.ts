import { isWorkspaceFileDragEvent } from './workspaceDrag'

export type ExternalDropZone = 'editor' | 'sidebar' | 'unsupported'

/** OS file manager drag (not in-app workspace file reorder). */
export function isExternalOsFileDrag(event: Pick<DragEvent, 'dataTransfer'>): boolean {
  const dt = event.dataTransfer
  if (!dt) return false
  if (isWorkspaceFileDragEvent(event)) return false
  const files = dt.files
  if (files && files.length > 0) return true
  return Array.from(dt.types).includes('Files')
}

export function getExternalFilesFromDataTransfer(event: Pick<DragEvent, 'dataTransfer'>): File[] {
  const dt = event.dataTransfer
  if (!dt) return []
  return Array.from(dt.files ?? [])
}

export function resolveExternalDropZone(clientX: number, clientY: number): ExternalDropZone {
  const el = document.elementFromPoint(clientX, clientY)
  if (!el) return 'unsupported'
  if (el.closest('[data-drop-zone="editor"]')) return 'editor'
  if (el.closest('[data-workspace-sidebar]')) return 'sidebar'
  if (el.closest('.main.main-with-rail') || el.closest('#editor-main-panel')) return 'editor'
  return 'unsupported'
}

export function allowExternalFileDropEffect(event: DragEvent): void {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}
