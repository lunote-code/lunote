export type FileContextMenuPick =
  | 'open'
  | 'openTab'
  | 'newFile'
  | 'newFileFromTemplate'
  | 'newFolder'
  | 'rename'
  | 'delete'
  | 'copyPath'
  | 'reveal'

export type FileContextTarget = {
  path: string
  isDirectory: boolean
  variant: 'item' | 'blank'
  /** When set, Delete removes all listed workspace file paths (Shift multi-select). */
  bulkDeletePaths?: string[]
}

export type FileContextMenuState = FileContextTarget & { x: number; y: number }

export type EditorDocMenuState = {
  x: number
  y: number
  /** Original pointer position for hit-testing image nodes under the menu. */
  clientX: number
  clientY: number
}

export type EditorDocMenuPick =
  | 'cut'
  | 'copy'
  | 'paste'
  | 'openTab'
  | 'save'
  | 'rename'
  | 'revert'
  | 'copyPath'
  | 'reveal'

export type TabContextMenuPick = 'close' | 'closeOthers' | 'closeLeft' | 'closeRight'
