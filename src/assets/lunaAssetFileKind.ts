export type LunaAssetFileKind = 'pdf' | 'word' | 'zip' | 'image' | 'file'

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'heif', 'heic'])
const WORD_EXT = new Set(['doc', 'docx', 'odt', 'rtf'])
const ZIP_EXT = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'])

export function fileExtensionFromName(name: string): string {
  const base = name.trim().replace(/\\/gu, '/').split('/').pop() ?? name
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return ''
  return base.slice(dot + 1).toLowerCase()
}

export function lunaAssetFileKindFromName(name: string): LunaAssetFileKind {
  const ext = fileExtensionFromName(name)
  if (ext === 'pdf') return 'pdf'
  if (WORD_EXT.has(ext)) return 'word'
  if (ZIP_EXT.has(ext)) return 'zip'
  if (IMAGE_EXT.has(ext)) return 'image'
  return 'file'
}

export function lunaAssetLinkClassForKind(kind: LunaAssetFileKind): string {
  return `pm-link-asset pm-link-asset--${kind}`
}
