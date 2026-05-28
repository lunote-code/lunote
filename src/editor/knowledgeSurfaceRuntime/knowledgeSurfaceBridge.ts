/**
 * KSR ↔ Knowledge Runtime / KIR Bridge
 */
import { onKnowledgeWorkspaceOpened } from '../knowledgeRuntime'
import { initKnowledgeInteractionRuntime, setKirContentResolver } from '../knowledgeInteractionRuntime'
import type { ContentResolver } from '../knowledgeInteractionRuntime'
import { initContextWorkspace, resetContextWorkspaceRuntime } from './contextWorkspaceRuntime'
import { resetWorkspaceDockRuntime } from './workspaceDockRuntime'
import { resetWorkspaceLayoutRuntime } from './workspaceLayoutRuntime'
import { resetSurfaceLifecycle } from './surfaceLifecycle'
import { resetSurfaceScheduler } from './surfaceScheduler'
import { resetSurfaceVirtualization } from './surfaceVirtualization'
import { resetHoverSurfaceRuntime } from './hoverSurfaceRuntime'
import { resetPeekSurfaceRuntime } from './peekSurfaceRuntime'
import { resetKnowledgeSidebarRuntime } from './knowledgeSidebarRuntime'
import { resetGraphSurfaceRuntime } from './graphSurfaceRuntime'
import { resetSearchSurfaceRuntime } from './searchSurfaceRuntime'
import { resetCommandPaletteRuntime } from './commandPaletteRuntime'
import { resetKnowledgeOverlayRuntime } from './knowledgeOverlayRuntime'
import { resetNavigationSurfaceRuntime } from './navigationSurfaceRuntime'

export function initKnowledgeSurfaceRuntime(contentResolver?: ContentResolver): void {
  if (contentResolver) setKirContentResolver(contentResolver)
  initKnowledgeInteractionRuntime()
  initContextWorkspace()
}

export function onKsrWorkspaceOpened(rootDir: string): void {
  onKnowledgeWorkspaceOpened(rootDir)
  initContextWorkspace()
}

export function setKsrContentResolver(resolver: ContentResolver | null): void {
  setKirContentResolver(resolver)
}

export {
  getSurfaceLayoutSnapshot,
  subscribeSurfaceLayout,
  reportPanelContainerRect,
} from '../knowledgeOS/surfaceLayoutRuntime'

export function resetKnowledgeSurfaceRuntime(): void {
  resetHoverSurfaceRuntime()
  resetPeekSurfaceRuntime()
  resetKnowledgeSidebarRuntime()
  resetGraphSurfaceRuntime()
  resetSearchSurfaceRuntime()
  resetCommandPaletteRuntime()
  resetKnowledgeOverlayRuntime()
  resetNavigationSurfaceRuntime()
  resetWorkspaceDockRuntime()
  resetWorkspaceLayoutRuntime()
  resetSurfaceLifecycle()
  resetSurfaceScheduler()
  resetSurfaceVirtualization()
  resetContextWorkspaceRuntime()
}
