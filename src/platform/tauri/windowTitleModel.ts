export type WindowTitleModelInput = {
  activePath: string
  rootDir: string
  tabLabel: (path: string) => string
  workspaceFolderName: string
}

export type WindowTitleModelParts = {
  documentTitle: string
  workspaceTitle: string
}

/** Derive native window title parts from active document + workspace. */
export function deriveWindowTitleParts(input: WindowTitleModelInput): WindowTitleModelParts {
  const { activePath, rootDir, tabLabel, workspaceFolderName } = input
  const workspaceTitle = rootDir.trim() ? workspaceFolderName : ''

  if (!activePath.trim()) {
    return { documentTitle: '', workspaceTitle }
  }

  const normalized = tabLabel(activePath).replace(/\\/g, '/')
  const fileName = normalized.split('/').pop() ?? normalized

  return {
    documentTitle: fileName.trim() || normalized.trim(),
    workspaceTitle,
  }
}
