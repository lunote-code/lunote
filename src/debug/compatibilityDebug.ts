type CompatibilityTraceFlag = 'dirty' | 'blankLine' | 'visualTail' | 'workspaceIndex'

const GLOBAL_FLAG_MAP: Record<CompatibilityTraceFlag, string> = {
  dirty: '__KOS_DIRTY_TRACE__',
  blankLine: '__KOS_BLANKLINE_TRACE__',
  visualTail: '__KOS_VISUAL_TAIL_TRACE__',
  workspaceIndex: '__KOS_WORKSPACE_INDEX_TRACE__',
}

const STORAGE_KEY_MAP: Record<CompatibilityTraceFlag, string> = {
  dirty: 'kos.dirtyTrace',
  blankLine: 'kos.blankLineTrace',
  visualTail: 'kos.visualTailTrace',
  workspaceIndex: 'kos.workspaceIndexTrace',
}

function hasGlobalTraceFlag(flag: CompatibilityTraceFlag): boolean {
  const traceGlobals = globalThis as Record<string, unknown>
  return traceGlobals[GLOBAL_FLAG_MAP[flag]] === true
}

function hasStorageTraceFlag(flag: CompatibilityTraceFlag): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_MAP[flag]) === '1'
  } catch {
    return false
  }
}

export function isCompatibilityTraceEnabled(flag: CompatibilityTraceFlag, fallbackFlags: CompatibilityTraceFlag[] = []): boolean {
  if (!import.meta.env.DEV) return false
  const flags = [flag, ...fallbackFlags]
  return flags.some((candidate) => hasGlobalTraceFlag(candidate) || hasStorageTraceFlag(candidate))
}
