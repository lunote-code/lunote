/** Max pasted image size (matches Rust import/clipboard limit). */
export const MAX_PASTE_IMAGE_BYTES = 20 * 1024 * 1024

/** Without a workspace, inline data URLs bloat the document — cap separately. */
export const MAX_INLINE_PASTE_IMAGE_BYTES = 2 * 1024 * 1024

export function isPasteImageTooLarge(byteLength: number): boolean {
  return byteLength > MAX_PASTE_IMAGE_BYTES
}

export function canInlinePasteWithoutWorkspace(byteLength: number): boolean {
  return byteLength <= MAX_INLINE_PASTE_IMAGE_BYTES
}
