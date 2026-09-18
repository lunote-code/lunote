import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { pathsEqual } from '../../lib/workspacePathUtils'
import { workspaceIdFromRoot } from '../../lunaPersistence'
import {
  getWorkspaceEncryptionStatus,
  WORKSPACE_ENCRYPTION_CHANGED_EVENT,
} from '../../platform/tauri/workspaceEncryptionService'
import type { FlatWorkspaceFile } from '../workspace/types'
import {
  loadNoteCalendarEditsIndex,
  mergeNoteCalendarEditsMaps,
  migrateNoteCalendarEditsForPathRename,
  noteCalendarEditsMapFromRecord,
  pruneNoteCalendarEditsToKnownFiles,
  recordNoteCalendarEditInMap,
  resolveNoteCalendarRelativePath,
  scheduleNoteCalendarEditsPersist,
} from '../noteCalendar/noteCalendarEditStore'

type Args = {
  rootDir: string
  workspaceFiles: readonly FlatWorkspaceFile[]
}

export function useNoteCalendarEdits({ rootDir, workspaceFiles }: Args) {
  const workspaceId = useMemo(
    () => (rootDir.trim() ? workspaceIdFromRoot(rootDir) : ''),
    [rootDir],
  )
  const [noteCalendarEdits, setNoteCalendarEdits] = useState<Map<string, number>>(
    () => new Map(),
  )
  const [noteCalendarPreferPersistedOnly, setNoteCalendarPreferPersistedOnly] = useState(false)
  const loadVersionRef = useRef(0)
  const loadedRef = useRef(false)

  const refreshEncryptionPreference = useCallback(async () => {
    if (!rootDir.trim()) {
      setNoteCalendarPreferPersistedOnly(false)
      return
    }
    const encryptionStatus = await getWorkspaceEncryptionStatus(rootDir)
    setNoteCalendarPreferPersistedOnly(encryptionStatus.enabled)
  }, [rootDir])

  useEffect(() => {
    loadedRef.current = false
    if (!rootDir.trim() || !workspaceId) {
      setNoteCalendarEdits(new Map())
      setNoteCalendarPreferPersistedOnly(false)
      return
    }

    const loadVersion = loadVersionRef.current + 1
    loadVersionRef.current = loadVersion
    let cancelled = false

    void (async () => {
      const [index, encryptionStatus] = await Promise.all([
        loadNoteCalendarEditsIndex(workspaceId),
        getWorkspaceEncryptionStatus(rootDir),
      ])
      if (cancelled || loadVersionRef.current !== loadVersion) return

      const loaded = noteCalendarEditsMapFromRecord(index)
      setNoteCalendarEdits((prev) => mergeNoteCalendarEditsMaps(loaded, prev))
      setNoteCalendarPreferPersistedOnly(encryptionStatus.enabled)
      loadedRef.current = true
    })()

    return () => {
      cancelled = true
    }
  }, [rootDir, workspaceId])

  useEffect(() => {
    if (!rootDir.trim()) return
    const onEncryptionChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ root?: string }>).detail
      if (detail?.root && !pathsEqual(detail.root, rootDir)) return
      void refreshEncryptionPreference()
    }
    window.addEventListener(WORKSPACE_ENCRYPTION_CHANGED_EVENT, onEncryptionChanged)
    return () => window.removeEventListener(WORKSPACE_ENCRYPTION_CHANGED_EVENT, onEncryptionChanged)
  }, [rootDir, refreshEncryptionPreference])

  useEffect(() => {
    if (!loadedRef.current || !workspaceId || workspaceFiles.length === 0) return
    setNoteCalendarEdits((prev) => {
      const pruned = pruneNoteCalendarEditsToKnownFiles(prev, workspaceFiles)
      if (pruned.size === prev.size) return prev
      scheduleNoteCalendarEditsPersist(workspaceId, pruned)
      return pruned
    })
  }, [workspaceFiles, workspaceId])

  const recordNoteCalendarEdit = useCallback(
    (absolutePath: string, editedAtMs = Date.now()) => {
      if (!rootDir.trim() || !workspaceId) return
      const relativePath = resolveNoteCalendarRelativePath(rootDir, absolutePath)
      if (!relativePath) return
      setNoteCalendarEdits((prev) => {
        const next = recordNoteCalendarEditInMap(prev, relativePath, editedAtMs)
        scheduleNoteCalendarEditsPersist(workspaceId, next)
        return next
      })
    },
    [rootDir, workspaceId],
  )

  const migrateNoteCalendarEditPath = useCallback(
    (oldAbsolutePath: string, newAbsolutePath: string) => {
      if (!rootDir.trim() || !workspaceId) return
      setNoteCalendarEdits((prev) => {
        const next = migrateNoteCalendarEditsForPathRename(
          prev,
          rootDir,
          oldAbsolutePath,
          newAbsolutePath,
        )
        if (next.size === prev.size) {
          let changed = false
          for (const [key, value] of next.entries()) {
            if (prev.get(key) !== value) {
              changed = true
              break
            }
          }
          if (!changed) return prev
        }
        scheduleNoteCalendarEditsPersist(workspaceId, next)
        return next
      })
    },
    [rootDir, workspaceId],
  )

  return {
    noteCalendarEdits,
    noteCalendarPreferPersistedOnly,
    recordNoteCalendarEdit,
    migrateNoteCalendarEditPath,
  }
}
