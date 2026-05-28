import type { Dispatch, SetStateAction } from 'react'

import type { TranslateFn } from '../../i18n'
import { getDocumentSavedContent } from '../../documentRuntime/documentKernel'
import { readNote } from '../../platform/tauri/documentService'

export type SaveConflictState = {
  path: string
  base: string
  local: string
  disk: string
}

export async function openSaveConflictDialog(args: {
  rootDir: string
  path: string
  local: string
  setSaveConflict: Dispatch<SetStateAction<SaveConflictState | null>>
  setStatus: (msg: string) => void
  t: TranslateFn
}): Promise<boolean> {
  const { rootDir, path, local, setSaveConflict, setStatus, t } = args
  try {
    const disk = await readNote(rootDir, path)
    setSaveConflict({
      path,
      base: getDocumentSavedContent(path) ?? '',
      local,
      disk,
    })
    return true
  } catch {
    setStatus(t('app.status.saveConflict'))
    return false
  }
}
