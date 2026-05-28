import {
  goToDefinition,
  navigateBack,
  navigateForward,
  getBreadcrumb,
  getActiveContextDocKey,
  resolveNavigationTarget,
  resolvePreviewTarget,
} from '../knowledgeInteractionRuntime'
import type { WikiLinkTarget } from '../knowledgeRuntime/types'
import type { NavigationTarget } from './types'
import { scheduleSurfaceTask } from './surfaceScheduler'

const stack: NavigationTarget[] = []
let stackIndex = -1
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((fn) => fn())
}

export function subscribeNavigationSurface(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function navigateToKnowledgeTarget(target: WikiLinkTarget): NavigationTarget | null {
  const nav = goToDefinition(target)
  if (!nav) return null
  const entry: NavigationTarget = {
    docKey: nav.docKey,
    absolutePath: nav.absolutePath,
    heading: nav.heading,
    blockId: nav.blockId,
  }
  pushNavigation(entry)
  return entry
}

export function pushNavigation(entry: NavigationTarget): void {
  stack.splice(stackIndex + 1)
  stack.push(entry)
  stackIndex = stack.length - 1
  if (stack.length > 200) {
    stack.shift()
    stackIndex -= 1
  }
  notify()
}

export function navigationGoBack(): NavigationTarget | null {
  const nav = navigateBack()
  if (!nav) return null
  const entry: NavigationTarget = {
    docKey: nav.docKey,
    absolutePath: nav.absolutePath,
    heading: nav.heading,
    blockId: nav.blockId,
  }
  stackIndex = Math.max(0, stackIndex - 1)
  notify()
  return entry
}

export function navigationGoForward(): NavigationTarget | null {
  const nav = navigateForward()
  if (!nav) return null
  const entry: NavigationTarget = {
    docKey: nav.docKey,
    absolutePath: nav.absolutePath,
    heading: nav.heading,
    blockId: nav.blockId,
  }
  stackIndex = Math.min(stack.length - 1, stackIndex + 1)
  notify()
  return entry
}

export function getNavigationBreadcrumb(docKey: string): Array<{ label: string; docKey: string }> {
  return getBreadcrumb(docKey)
}

export function getNavigationStack(): readonly NavigationTarget[] {
  return stack
}

export function scheduleContextJump(
  target: WikiLinkTarget,
  onResolved: (nav: NavigationTarget | null) => void,
): void {
  scheduleSurfaceTask({
    key: `nav:${target.docKey}`,
    kind: 'hover',
    priority: 'critical',
    run: () => {
      const preview = resolvePreviewTarget(target)
      onResolved(resolveNavigationTarget(preview))
    },
  })
}

export function graphJumpToDoc(docKey: string): NavigationTarget | null {
  return navigateToKnowledgeTarget({ docKey })
}

export function getNavigationContextDocKey(): string | null {
  return getActiveContextDocKey()
}

export function resetNavigationSurfaceRuntime(): void {
  stack.length = 0
  stackIndex = -1
  listeners.clear()
}
