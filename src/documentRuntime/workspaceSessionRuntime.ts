export type WorkspaceSessionState =
  | 'idle'
  | 'booting'
  | 'restoring'
  | 'indexing'
  | 'openingInitialDocument'
  | 'ready'
  | 'failed'

export type WorkspaceSessionSnapshot = {
  state: WorkspaceSessionState
  rootDir: string | null
  activePath: string | null
  openTabs: string[]
  error?: string
  updatedAt: number
}

let snapshot: WorkspaceSessionSnapshot = {
  state: 'idle',
  rootDir: null,
  activePath: null,
  openTabs: [],
  updatedAt: 0,
}

const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

export function getWorkspaceSessionSnapshot(): WorkspaceSessionSnapshot {
  return {
    ...snapshot,
    openTabs: [...snapshot.openTabs],
  }
}

export function subscribeWorkspaceSession(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function transitionWorkspaceSession(
  next: Partial<Omit<WorkspaceSessionSnapshot, 'updatedAt'>>,
): WorkspaceSessionSnapshot {
  snapshot = {
    ...snapshot,
    ...next,
    openTabs: next.openTabs ? [...next.openTabs] : snapshot.openTabs,
    updatedAt: Date.now(),
  }
  notify()
  return getWorkspaceSessionSnapshot()
}

export function resetWorkspaceSessionRuntime(): void {
  snapshot = {
    state: 'idle',
    rootDir: null,
    activePath: null,
    openTabs: [],
    updatedAt: 0,
  }
  notify()
}
