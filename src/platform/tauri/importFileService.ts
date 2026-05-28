import { invoke, isTauri } from '@tauri-apps/api/core'

export type PickedImportFile = {
  fileName: string
  mimeType: string
  dataBase64: string
}

export async function pickImportFilesBase64(options: {
  title: string
  multiple?: boolean
  extensions?: string[]
}): Promise<PickedImportFile[]> {
  if (!isTauri()) return []
  return invoke<PickedImportFile[]>('pick_import_files_base64', {
    payload: {
      title: options.title,
      multiple: options.multiple ?? false,
      extensions: options.extensions,
    },
  })
}

export function pickedImportFileToFile(picked: PickedImportFile): File {
  const binary = atob(picked.dataBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new File([bytes], picked.fileName, { type: picked.mimeType })
}
