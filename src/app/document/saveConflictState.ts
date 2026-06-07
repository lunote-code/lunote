import type { Dispatch, SetStateAction } from 'react'

import type { TranslateFn } from '../../i18n'
import { getDocumentSavedContent } from '../../documentRuntime/documentKernel'
import { readNote } from '../../platform/tauri/documentService'
import type { AppStatusTone } from '../hooks/useAppStatus'

export type SaveConflictState = {
  path: string
  base: string
  local: string
  disk: string
  diskReadable: boolean
  sourceMode: 'manual' | 'autosave'
}

export async function openSaveConflictDialog(args: {
  rootDir: string
  path: string
  local: string
  sourceMode?: 'manual' | 'autosave'
  setSaveConflict: Dispatch<SetStateAction<SaveConflictState | null>>
  setStatus: (msg: string, toneOverride?: AppStatusTone) => void
  t: TranslateFn
}): Promise<boolean> {
  const { rootDir, path, local, setSaveConflict, setStatus, t, sourceMode = 'manual' } = args
  try {
    const disk = await readNote(rootDir, path)
    setSaveConflict({
      path,
      base: getDocumentSavedContent(path) ?? '',
      local,
      disk,
      diskReadable: true,
      sourceMode,
    })
    setStatus(t('app.status.saveConflict'), sourceMode === 'autosave' ? 'warning' : 'error')
    return true
  } catch {
    setSaveConflict({
      path,
      base: getDocumentSavedContent(path) ?? '',
      local,
      disk: '',
      diskReadable: false,
      sourceMode,
    })
    setStatus(t('app.status.saveConflict'), sourceMode === 'autosave' ? 'warning' : 'error')
    return true
  }
}
