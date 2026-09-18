import {
  useCallback,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
  type MouseEvent as ReactMouseEvent,
} from 'react'

import { useNoteCalendarEdits } from '../hooks/useNoteCalendarEdits'
import { useRenameAndFileOps, type RenameAndFileOpsDeps } from '../hooks/useRenameAndFileOps'
import {
  useWorkspaceExternalFileDrop,
  type WorkspaceExternalFileDropDeps,
} from '../hooks/useWorkspaceExternalFileDrop'
import { useWorkspaceSidebar, type WorkspaceSidebarDeps } from '../hooks/useWorkspaceSidebar'

export type WorkspaceChromeControllerParams = {
  onWorkspaceDocumentSavedRef: MutableRefObject<(path: string, savedAtMs?: number) => void>
  migrateNoteCalendarEditPathRef: MutableRefObject<(oldPath: string, newPath: string) => void>
  touchWorkspaceFileModifiedAt: (path: string, modifiedAtMs?: number) => void
  dispatchOpenDocumentInTabViaRef: (root: string, path: string, reason?: string) => Promise<void>
  renameDeps: Omit<RenameAndFileOpsDeps, 'clearWorkspaceFileSelectionRef' | 'onNoteCalendarPathRenamed'>
  sidebarDeps: Omit<WorkspaceSidebarDeps, 'handleMoveFileToFolder' | 'dispatchOpenDocumentInTab'>
  externalDropDeps: Omit<WorkspaceExternalFileDropDeps, 'handleMoveFileToFolder' | 'dispatchOpenDocument'>
}

/** Workspace sidebar, file ops, calendar edits, and external drop orchestration extracted from AppRoot. */
export function useWorkspaceChromeController(params: WorkspaceChromeControllerParams) {
  const {
    onWorkspaceDocumentSavedRef,
    migrateNoteCalendarEditPathRef,
    touchWorkspaceFileModifiedAt,
    dispatchOpenDocumentInTabViaRef,
    renameDeps,
    sidebarDeps,
    externalDropDeps,
  } = params

  const clearWorkspaceFileSelectionRef = useRef<(() => void) | null>(null)

  const fileOps = useRenameAndFileOps({
    ...renameDeps,
    clearWorkspaceFileSelectionRef,
    onNoteCalendarPathRenamed: (oldPath, newPath) => {
      migrateNoteCalendarEditPathRef.current(oldPath, newPath)
    },
  })

  const sidebar = useWorkspaceSidebar({
    ...sidebarDeps,
    handleMoveFileToFolder: fileOps.handleMoveFileToFolder,
    dispatchOpenDocumentInTab: dispatchOpenDocumentInTabViaRef,
  })

  const calendar = useNoteCalendarEdits({
    rootDir: sidebarDeps.rootDir,
    workspaceFiles: sidebar.sortedFlatWorkspaceFiles,
  })

  useLayoutEffect(() => {
    onWorkspaceDocumentSavedRef.current = (path, savedAtMs = Date.now()) => {
      touchWorkspaceFileModifiedAt(path, savedAtMs)
      calendar.recordNoteCalendarEdit(path, savedAtMs)
    }
    migrateNoteCalendarEditPathRef.current = calendar.migrateNoteCalendarEditPath
    clearWorkspaceFileSelectionRef.current = sidebar.clearWorkspaceFileSelection
  }, [
    calendar.migrateNoteCalendarEditPath,
    calendar.recordNoteCalendarEdit,
    migrateNoteCalendarEditPathRef,
    onWorkspaceDocumentSavedRef,
    sidebar.clearWorkspaceFileSelection,
    touchWorkspaceFileModifiedAt,
  ])

  const onWorkspaceFileClick = useCallback(
    (e: ReactMouseEvent, path: string) => {
      sidebar.handleWorkspaceFileClick(path, {
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
      })
    },
    [sidebar.handleWorkspaceFileClick],
  )

  const externalDrop = useWorkspaceExternalFileDrop({
    ...externalDropDeps,
    handleMoveFileToFolder: fileOps.handleMoveFileToFolder,
    dispatchOpenDocument: renameDeps.dispatchOpenDocument,
  })

  return {
    ...fileOps,
    ...sidebar,
    noteCalendarEdits: calendar.noteCalendarEdits,
    noteCalendarPreferPersistedOnly: calendar.noteCalendarPreferPersistedOnly,
    onWorkspaceFileClick,
    externalDragActive: externalDrop.externalDragActive,
    dropZone: externalDrop.dropZone,
    shellDragProps: externalDrop.shellDragProps,
  }
}
