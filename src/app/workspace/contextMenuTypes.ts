export type FileContextMenuPick =
  | 'open'
  | 'openTab'
  | 'newFile'
  | 'newFolder'
  | 'rename'
  | 'delete'
  | 'copyPath'
  | 'reveal'

export type FileContextTarget = { path: string; isDirectory: boolean; variant: 'item' | 'blank' }

export type FileContextMenuState = FileContextTarget & { x: number; y: number }

export type EditorDocMenuState = { x: number; y: number; hasTextSelection: boolean }

export type EditorDocMenuPick =
  | 'cut'
  | 'copy'
  | 'paste'
  | 'selectAll'
  | 'openTab'
  | 'save'
  | 'rename'
  | 'revert'
  | 'copyPath'
  | 'reveal'

export type TabContextMenuPick = 'close' | 'closeOthers' | 'closeLeft' | 'closeRight'
