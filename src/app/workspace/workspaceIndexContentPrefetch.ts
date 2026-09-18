import { pathCompareKey, resolveWorkspaceFilePath } from '../../lib/workspacePathUtils'

type PrefetchEntry = {
  path: string
  content: string
}

const prefetchedByRoot = new Map<string, Map<string, PrefetchEntry>>()

function rootKey(root: string): string {
  return pathCompareKey(root.trim())
}

function entryKey(path: string): string {
  return pathCompareKey(path.trim())
}

export function recordWorkspaceIndexPrefetch(root: string, path: string, content: string): void {
  const rootNorm = root.trim()
  const pathNorm = resolveWorkspaceFilePath(rootNorm, path.trim())
  if (!rootNorm || !pathNorm) return
  let store = prefetchedByRoot.get(rootKey(rootNorm))
  if (!store) {
    store = new Map()
    prefetchedByRoot.set(rootKey(rootNorm), store)
  }
  store.set(entryKey(pathNorm), { path: pathNorm, content })
}

export function createWorkspaceIndexReadContent(
  rootDir: string,
  readContent: (path: string) => Promise<string>,
): (path: string) => Promise<string> {
  const rk = rootKey(rootDir)
  return async (path: string) => {
    const pathNorm = path.trim()
    let store = prefetchedByRoot.get(rk)
    if (!store) {
      store = new Map()
      prefetchedByRoot.set(rk, store)
    }
    const cached = store.get(entryKey(pathNorm))
    if (cached) return cached.content
    const content = await readContent(pathNorm)
    store.set(entryKey(pathNorm), { path: pathNorm, content })
    return content
  }
}

export function drainWorkspaceIndexPrefetches(root: string): PrefetchEntry[] {
  const store = prefetchedByRoot.get(rootKey(root))
  if (!store) return []
  return [...store.values()]
}

export function clearWorkspaceIndexPrefetches(root?: string): void {
  if (root?.trim()) {
    prefetchedByRoot.delete(rootKey(root))
    return
  }
  prefetchedByRoot.clear()
}
