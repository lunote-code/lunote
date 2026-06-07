import { pathsEqual } from '../../lib/workspacePathUtils'

export type TabVisualSession = {
  pmAnchor: number
  pmHead: number
  scrollRatio?: number
}

export type TabSourceSession = {
  /** Selection in body-only coordinates (stable across YAML prefix changes). */
  bodyFrom: number
  bodyTo: number
  scrollTop: number
}

export type TabEditorSession = {
  visual?: TabVisualSession
  source?: TabSourceSession
}

const sessions: Record<string, TabEditorSession> = {}

function findKey(path: string): string | undefined {
  if (!path) return undefined
  if (path in sessions) return path
  return Object.keys(sessions).find((k) => pathsEqual(k, path))
}

export function getTabEditorSession(path: string): TabEditorSession | undefined {
  const key = findKey(path)
  return key != null ? sessions[key] : undefined
}

export function setTabEditorSession(path: string, session: TabEditorSession): void {
  if (!path) return
  const key = findKey(path)
  if (key != null && key !== path) delete sessions[key]
  sessions[path] = session
}

export function deleteTabEditorSession(path: string): void {
  const key = findKey(path)
  if (key != null) delete sessions[key]
}

export function clearTabEditorSessions(): void {
  for (const key of Object.keys(sessions)) delete sessions[key]
}
