import { invoke, isTauri } from '@tauri-apps/api/core'

export type ImportExternalPathsResult = {
  importedPaths: string[]
  fileCount: number
  folderCount: number
}

export async function importExternalPathsIntoWorkspace(
  root: string,
  destDir: string,
  sources: string[],
): Promise<ImportExternalPathsResult> {
  if (!isTauri() || sources.length === 0) {
    return { importedPaths: [], fileCount: 0, folderCount: 0 }
  }
  return invoke<ImportExternalPathsResult>('import_external_paths_into_workspace', {
    payload: { root, destDir, sources },
  })
}

export async function workspacePathIsDirectory(root: string, path: string): Promise<boolean> {
  if (!isTauri()) return false
  return invoke<boolean>('workspace_path_is_directory', { payload: { root, path } })
}

export async function importDroppedFileBytesIntoWorkspace(
  root: string,
  destDir: string,
  fileName: string,
  dataBase64: string,
): Promise<string> {
  return invoke<string>('import_dropped_file_bytes', {
    payload: { root, destDir, fileName, dataBase64 },
  })
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Failed to read file'))
        return
      }
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/** Browser drag-drop (no native paths): write each file into the vault folder. */
export async function importDroppedFilesIntoWorkspace(
  root: string,
  destDir: string,
  files: readonly File[],
): Promise<string[]> {
  const imported: string[] = []
  for (const file of files) {
    const dataBase64 = await fileToBase64(file)
    const path = await importDroppedFileBytesIntoWorkspace(root, destDir, file.name, dataBase64)
    imported.push(path)
  }
  return imported
}
