import { isTauri } from '@tauri-apps/api/core'

import { pickImportFilesBase64, pickedImportFileToFile } from '../platform/tauri/importFileService'

function pickViaBrowserInput(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = false
    input.style.display = 'none'
    document.body.appendChild(input)

    const finish = (file: File | null) => {
      window.removeEventListener('focus', onWindowFocus, true)
      input.remove()
      resolve(file)
    }

    const onWindowFocus = () => {
      window.setTimeout(() => finish(input.files?.[0] ?? null), 0)
    }

    input.addEventListener(
      'change',
      () => {
        finish(input.files?.[0] ?? null)
      },
      { once: true },
    )

    window.addEventListener('focus', onWindowFocus, true)
    input.click()
  })
}

/** Wait for the current UI update to complete before opening the native dialog box to avoid lagging when the slash menu is closed.*/
function deferToUiReady(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

let pickDialogInFlight: Promise<File | null> | null = null

/** Select a single local file (any type) for use in scenarios such as slash "file link"*/
export async function pickLocalAssetFile(options: { title: string }): Promise<File | null> {
  if (pickDialogInFlight) return pickDialogInFlight

  pickDialogInFlight = (async () => {
    await deferToUiReady()
    if (isTauri()) {
      const picked = await pickImportFilesBase64({ title: options.title, multiple: false })
      const first = picked[0]
      if (!first) return null
      try {
        return pickedImportFileToFile(first)
      } catch {
        return null
      }
    }
    return pickViaBrowserInput()
  })().finally(() => {
    pickDialogInFlight = null
  })

  return pickDialogInFlight
}
