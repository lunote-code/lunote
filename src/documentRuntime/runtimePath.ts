const BUFFER_TAB_PREFIX = 'luna:buf:'

export function isBufferTabId(path: string): boolean {
  return path.startsWith(BUFFER_TAB_PREFIX)
}
