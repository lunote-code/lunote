import type { Dispatch, SetStateAction } from 'react'

import type { TranslateFn } from '../../i18n'
import { getDocumentSavedContent } from '../../documentRuntime/documentKernel'
import { diskMarkdownForDocumentSave } from '../../lib/editorContentSync'
import { readNote } from '../../platform/tauri/documentService'
import type { AppStatusTone } from '../hooks/useAppStatus'

export type SaveConflictSourceMode = 'manual' | 'autosave' | 'external'

export type SaveConflictState = {
  path: string
  base: string
  local: string
  disk: string
  diskReadable: boolean
  sourceMode: SaveConflictSourceMode
}

function statusToneForSourceMode(sourceMode: SaveConflictSourceMode): AppStatusTone {
  if (sourceMode === 'manual') return 'error'
  return 'warning'
}

function statusMessageForSourceMode(
  sourceMode: SaveConflictSourceMode,
  t: TranslateFn,
): string {
  if (sourceMode === 'external') return t('app.status.externalFileChangedConflict')
  return t('app.status.saveConflict')
}

export async function openSaveConflictDialog(args: {
  rootDir: string
  path: string
  local: string
  sourceMode?: SaveConflictSourceMode
  setSaveConflict: Dispatch<SetStateAction<SaveConflictState | null>>
  setStatus: (msg: string, toneOverride?: AppStatusTone) => void
  t: TranslateFn
}): Promise<boolean> {
  const { rootDir, path, local, setSaveConflict, setStatus, t, sourceMode = 'manual' } = args
  // Always merge cached YAML so "keep local" never force-writes a body-only surface.
  const localDiskMarkdown = diskMarkdownForDocumentSave(path, local)
  try {
    const disk = await readNote(rootDir, path)
    setSaveConflict({
      path,
      base: getDocumentSavedContent(path) ?? '',
      local: localDiskMarkdown,
      disk,
      diskReadable: true,
      sourceMode,
    })
    setStatus(statusMessageForSourceMode(sourceMode, t), statusToneForSourceMode(sourceMode))
    return true
  } catch {
    setSaveConflict({
      path,
      base: getDocumentSavedContent(path) ?? '',
      local: localDiskMarkdown,
      disk: '',
      diskReadable: false,
      sourceMode,
    })
    setStatus(statusMessageForSourceMode(sourceMode, t), statusToneForSourceMode(sourceMode))
    return true
  }
}
