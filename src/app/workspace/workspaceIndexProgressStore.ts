export type WorkspaceIndexProgress = {
  root: string
  phase: 'reading' | 'writing'
  processed: number
  total: number
}

let progress: WorkspaceIndexProgress | null = null
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

export function getWorkspaceIndexProgressSnapshot(): WorkspaceIndexProgress | null {
  return progress
}

export function subscribeWorkspaceIndexProgress(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setWorkspaceIndexProgress(next: WorkspaceIndexProgress): void {
  progress = next
  notify()
}

export function patchWorkspaceIndexProgress(
  root: string,
  patch: Partial<Omit<WorkspaceIndexProgress, 'root'>>,
): void {
  if (!progress || progress.root !== root) {
    progress = {
      root,
      phase: patch.phase ?? 'reading',
      processed: patch.processed ?? 0,
      total: patch.total ?? 0,
    }
  } else {
    progress = { ...progress, ...patch }
  }
  notify()
}

export function clearWorkspaceIndexProgress(root?: string): void {
  if (root && progress?.root !== root) return
  progress = null
  notify()
}

export function resetWorkspaceIndexProgressStoreForTests(): void {
  progress = null
  listeners.clear()
}
