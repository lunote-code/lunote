import { invoke, isTauri } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

export type PickedImportFile = {
  fileName: string
  mimeType: string
  dataBase64: string
}

function normalizeDialogPaths(result: string | string[] | null): string[] {
  if (result == null) return []
  return Array.isArray(result) ? result : [result]
}

/** Pick via non-blocking plugin dialog, then read bytes on the Rust side. */
export async function pickImportFilesBase64(options: {
  title: string
  multiple?: boolean
  extensions?: string[]
}): Promise<PickedImportFile[]> {
  if (!isTauri()) return []

  const multiple = options.multiple ?? false
  const exts = options.extensions?.filter((e) => e.length > 0)
  const selected = await open({
    title: options.title,
    multiple,
    directory: false,
    ...(exts?.length ? { filters: [{ name: 'files', extensions: exts }] } : {}),
  })
  const paths = normalizeDialogPaths(selected)
  if (paths.length === 0) return []

  return invoke<PickedImportFile[]>('read_import_files_base64', {
    payload: { paths },
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
