import { useCallback, useEffect, useRef, useState, type DragEvent as ReactDragEvent } from 'react'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'

import {
  pickedImportFileToFile,
  type PickedImportFile,
} from '../../platform/tauri/importFileService'
import {
  allowExternalFileDropEffect,
  getExternalFilesFromDataTransfer,
  isExternalOsFileDrag,
  resolveExternalDropZone,
  type ExternalDropZone,
} from '../workspace/externalFileDrag'
import {
  importOsEntriesIntoVaultFolder,
  resolveSidebarImportDest,
  type WorkspaceOsVaultImportDeps,
} from '../workspace/workspaceOsVaultImport'
import { resolveWorkspaceSidebarDropTarget } from '../workspace/workspaceSidebarDropTarget'

const EXTERNAL_DRAG_BODY_CLASS = 'is-external-file-dragging'

/** Tauri unlisten may return a Promise; swallow double-unlisten rejections. */
function releaseTauriUnlisten(unlisten: (() => void) | undefined): void {
  if (!unlisten) return
  try {
    void Promise.resolve(unlisten()).catch(() => undefined)
  } catch {
    /* listener already removed */
  }
}

function dragPositionToClient(position: { x: number; y: number }): { x: number; y: number } {
  const scale = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  return { x: position.x / scale, y: position.y / scale }
}

export type WorkspaceExternalFileDropDeps = WorkspaceOsVaultImportDeps & {
  draggingWorkspaceFile: string[] | null
  dropFilesIntoActiveNote: (files: File[]) => Promise<void>
}

export function useWorkspaceExternalFileDrop(deps: WorkspaceExternalFileDropDeps) {
  const {
    t,
    rootDir,
    draggingWorkspaceFile,
    setStatus,
    setDragOverTarget,
    dropFilesIntoActiveNote,
    setExpandedDirs,
    refreshFileTree,
    handleMoveFileToFolder,
    dispatchOpenDocument,
  } = deps

  const [externalDragActive, setExternalDragActive] = useState(false)
  const [dropZone, setDropZone] = useState<ExternalDropZone | null>(null)
  const dragDepthRef = useRef(0)
  const nativeDropHandledRef = useRef(false)

  const endExternalDrag = useCallback(() => {
    dragDepthRef.current = 0
    setExternalDragActive(false)
    setDropZone(null)
    setDragOverTarget(null)
    document.body.classList.remove(EXTERNAL_DRAG_BODY_CLASS)
  }, [setDragOverTarget])

  const shouldIgnore = useCallback(() => Boolean(draggingWorkspaceFile), [draggingWorkspaceFile])

  const updateDragUi = useCallback(
    (clientX: number, clientY: number) => {
      const zone = resolveExternalDropZone(clientX, clientY)
      setDropZone(zone)
      if (zone === 'sidebar' && rootDir.trim()) {
        const target = resolveWorkspaceSidebarDropTarget(clientX, clientY, rootDir)
        setDragOverTarget(target)
      } else {
        setDragOverTarget(null)
      }
    },
    [rootDir, setDragOverTarget],
  )

  const handleOsDrop = useCallback(
    async (clientX: number, clientY: number, paths: string[], files: File[]) => {
      endExternalDrag()
      if (!rootDir.trim()) {
        setStatus(t('app.drop.needWorkspace'))
        return
      }

      const zone = resolveExternalDropZone(clientX, clientY)
      if (zone === 'sidebar') {
        const destDir = resolveSidebarImportDest(clientX, clientY, rootDir)
        if (!destDir) {
          setStatus(t('app.drop.sidebarNeedFolder'))
          return
        }
        await importOsEntriesIntoVaultFolder(
          {
            t,
            rootDir,
            setStatus,
            setDragOverTarget,
            setExpandedDirs,
            refreshFileTree,
            handleMoveFileToFolder,
            dispatchOpenDocument,
          },
          destDir,
          {
          paths: paths.length > 0 ? paths : undefined,
          files: paths.length === 0 ? files : undefined,
        })
        return
      }
      if (zone !== 'editor') {
        setStatus(t('app.drop.useEditor'))
        return
      }
      if (paths.length > 0 && isTauri()) {
        const picked = await invoke<PickedImportFile[]>('read_import_files_base64', {
          payload: { paths },
        })
        await dropFilesIntoActiveNote(picked.map(pickedImportFileToFile))
        return
      }
      if (files.length > 0) {
        await dropFilesIntoActiveNote(files)
      }
    },
    [
      dispatchOpenDocument,
      dropFilesIntoActiveNote,
      endExternalDrag,
      handleMoveFileToFolder,
      refreshFileTree,
      rootDir,
      setDragOverTarget,
      setExpandedDirs,
      setStatus,
      t,
    ],
  )

  const shouldIgnoreRef = useRef(shouldIgnore)
  shouldIgnoreRef.current = shouldIgnore
  const updateDragUiRef = useRef(updateDragUi)
  updateDragUiRef.current = updateDragUi
  const endExternalDragRef = useRef(endExternalDrag)
  endExternalDragRef.current = endExternalDrag
  const handleOsDropRef = useRef(handleOsDrop)
  handleOsDropRef.current = handleOsDrop

  const onDragEnterCapture = useCallback(
    (event: ReactDragEvent) => {
      if (isTauri()) return
      if (shouldIgnore() || !isExternalOsFileDrag(event.nativeEvent)) return
      const related = event.relatedTarget as Node | null
      if (related && event.currentTarget.contains(related)) return
      dragDepthRef.current += 1
      if (dragDepthRef.current === 1) {
        document.body.classList.add(EXTERNAL_DRAG_BODY_CLASS)
        setExternalDragActive(true)
      }
      allowExternalFileDropEffect(event.nativeEvent)
      updateDragUi(event.clientX, event.clientY)
    },
    [shouldIgnore, updateDragUi],
  )

  const onDragOverCapture = useCallback(
    (event: ReactDragEvent) => {
      if (isTauri()) return
      if (shouldIgnore() || !isExternalOsFileDrag(event.nativeEvent)) return
      allowExternalFileDropEffect(event.nativeEvent)
      updateDragUi(event.clientX, event.clientY)
    },
    [shouldIgnore, updateDragUi],
  )

  const onDragLeaveCapture = useCallback(
    (event: ReactDragEvent) => {
      if (isTauri()) return
      if (!externalDragActive) return
      const related = event.relatedTarget as Node | null
      if (related && event.currentTarget.contains(related)) return
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
      if (dragDepthRef.current === 0) {
        endExternalDrag()
      }
    },
    [endExternalDrag, externalDragActive],
  )

  const onDropCapture = useCallback(
    (event: ReactDragEvent) => {
      if (shouldIgnore() || !isExternalOsFileDrag(event.nativeEvent)) return
      event.preventDefault()
      event.stopPropagation()
      if (isTauri() && nativeDropHandledRef.current) {
        nativeDropHandledRef.current = false
        return
      }

      const files = getExternalFilesFromDataTransfer(event.nativeEvent)
      void handleOsDrop(event.clientX, event.clientY, [], files)
    },
    [handleOsDrop, shouldIgnore],
  )

  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    let unlisten: (() => void) | undefined

    const release = () => {
      const off = unlisten
      unlisten = undefined
      releaseTauriUnlisten(off)
    }

    void getCurrentWebviewWindow()
      .onDragDropEvent((event) => {
        if (cancelled) return
        const { payload } = event
        if (shouldIgnoreRef.current()) return

        if (payload.type === 'enter') {
          dragDepthRef.current = 1
          document.body.classList.add(EXTERNAL_DRAG_BODY_CLASS)
          setExternalDragActive(true)
          const { x, y } = dragPositionToClient(payload.position)
          updateDragUiRef.current(x, y)
          return
        }
        if (payload.type === 'over') {
          const { x, y } = dragPositionToClient(payload.position)
          updateDragUiRef.current(x, y)
          return
        }
        if (payload.type === 'leave') {
          endExternalDragRef.current()
          return
        }
        if (payload.type === 'drop') {
          nativeDropHandledRef.current = true
          const { x, y } = dragPositionToClient(payload.position)
          void handleOsDropRef.current(x, y, payload.paths, [])
        }
      })
      .then((off) => {
        if (cancelled) {
          releaseTauriUnlisten(off)
          return
        }
        unlisten = off
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
      release()
    }
  }, [])

  return {
    externalDragActive,
    dropZone,
    shellDragProps: {
      onDragEnterCapture,
      onDragOverCapture,
      onDragLeaveCapture,
      onDropCapture,
    },
  }
}
