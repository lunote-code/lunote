import { isTauri } from '@tauri-apps/api/core'

import {
  pickImportFilesBase64,
  pickedImportFileToFile,
} from '../platform/tauri/importFileService'

export const IMAGE_FILE_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
  'avif',
  'heif',
] as const

const IMAGE_EXTENSION_SET = new Set<string>(IMAGE_FILE_EXTENSIONS)

export function imageAltFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/u, '').trim()
  return base || 'image'
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  return IMAGE_EXTENSION_SET.has(ext)
}

function pickImagesViaBrowserInput(multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = multiple
    input.style.display = 'none'
    document.body.appendChild(input)

    const finish = (files: File[]) => {
      window.removeEventListener('focus', onWindowFocus, true)
      input.remove()
      resolve(files.filter(isImageFile))
    }

    const onWindowFocus = () => {
      window.setTimeout(() => finish(Array.from(input.files ?? [])), 0)
    }

    input.addEventListener(
      'change',
      () => {
        finish(Array.from(input.files ?? []))
      },
      { once: true },
    )

    window.addEventListener('focus', onWindowFocus, true)
    input.click()
  })
}

export async function pickLocalImageFiles(options: {
  title: string
  multiple?: boolean
}): Promise<File[]> {
  const multiple = options.multiple ?? true

  if (isTauri()) {
    const picked = await pickImportFilesBase64({
      title: options.title,
      multiple,
      extensions: [...IMAGE_FILE_EXTENSIONS],
    })
    return picked.map(pickedImportFileToFile).filter(isImageFile)
  }

  return pickImagesViaBrowserInput(multiple)
}
