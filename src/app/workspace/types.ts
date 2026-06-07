export type SearchResult = {
  path: string
  title: string
  snippet: string
}

export type FsTreeNode = {
  name: string
  path: string
  kind: string
  modifiedAtMs?: number | null
  createdAtMs?: number | null
  children: FsTreeNode[]
}

export type FlatWorkspaceFile = {
  path: string
  label: string
  sublabel?: string
  relativePath: string
  modifiedAtMs?: number | null
  createdAtMs?: number | null
}
export type FileSortMode = 'group' | 'naturalAsc' | 'nameAsc' | 'modifiedAsc' | 'createdAsc'
export type RenameDialogState = {
  root: string
  oldPath: string
  isDirectory: boolean
  mode: 'rename' | 'newFolder' | 'newNote' | 'newNoteFromTemplate'
  parentPath: string
  /** Whether to open the new note in a tab after it is completed*/
  openInTab?: boolean
  /** Optional template used to generate the new note body */
  templatePath?: string
}
export type DeleteConfirmDialogState = {
  title: string
  message: string
  fileLabel: string
}
export type ConfirmDialogState = {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  variant: 'default' | 'warning'
}
export type UnsavedChangesDialogState = {
  title: string
  message: string
  saveLabel: string
  discardLabel: string
  cancelLabel: string
}
export type UnsavedChangesChoice = 'save' | 'discard' | 'cancel'
export type AlertDialogState = {
  title: string
  message: string
  okLabel: string
}
