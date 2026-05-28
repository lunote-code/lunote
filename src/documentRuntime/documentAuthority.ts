import { getTabBodyCacheSnapshot } from '../app/document/tabBodiesStore'
import { getDocumentRuntimeSnapshot } from './documentKernel'
import { pathsEqual } from '../lib/workspacePathUtils'

export type DocumentAuthorityProjection = {
  runtime: ReturnType<typeof getDocumentRuntimeSnapshot>
  derivedTabBodies: Readonly<Record<string, string>>
}

export type ResolveDocumentBodyOptions = {
  projection?: DocumentAuthorityProjection
  contentFallback?: string
  bufferBodies?: Readonly<Record<string, string>>
}

export function getDocumentAuthorityProjection(): DocumentAuthorityProjection {
  return {
    runtime: getDocumentRuntimeSnapshot(),
    derivedTabBodies: getTabBodyCacheSnapshot(),
  }
}

export function getDerivedBodyForPath(path: string): string | undefined {
  const caches = getTabBodyCacheSnapshot()
  return Object.entries(caches).find(([key]) => pathsEqual(key, path))?.[1]
}

export function isDocumentAuthorityPath(path: string): boolean {
  return pathsEqual(getDocumentRuntimeSnapshot().activePath, path)
}

export function resolveDocumentBody(path: string, options?: ResolveDocumentBodyOptions): string | undefined {
  if (!path) return options?.contentFallback
  const projection = options?.projection ?? getDocumentAuthorityProjection()
  if (pathsEqual(projection.runtime.activePath, path)) {
    return projection.runtime.content
  }
  const derived = Object.entries(projection.derivedTabBodies).find(([key]) => pathsEqual(key, path))?.[1]
  if (derived !== undefined) return derived
  if (options?.bufferBodies) {
    const buffered = Object.entries(options.bufferBodies).find(([key]) => pathsEqual(key, path))?.[1]
    if (buffered !== undefined) return buffered
  }
  return options?.contentFallback
}
