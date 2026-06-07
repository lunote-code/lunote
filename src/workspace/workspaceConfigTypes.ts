export type WorkspaceTemplatesConfig = {
  folder?: string
  defaultNewNote?: string
  /** Most recently selected templates in this workspace, newest first. */
  recentlyUsed?: string[]
}

export type WorkspaceDailyNotesConfig = {
  enabled?: boolean
  folder?: string
  /** Filename date pattern, e.g. YYYY-MM-DD */
  format?: string
  template?: string
  openOnStartup?: boolean
}

export type WorkspaceConfig = {
  version: number
  templates?: WorkspaceTemplatesConfig
  dailyNotes?: WorkspaceDailyNotesConfig
}

export const WORKSPACE_CONFIG_RELATIVE_PATH = '.lunote/workspace.json'

export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
  version: 1,
  templates: {
    folder: 'Templates',
    defaultNewNote: 'Templates/Default.md',
    recentlyUsed: [],
  },
  dailyNotes: {
    enabled: true,
    folder: 'Daily',
    format: 'YYYY-MM-DD',
    template: 'Templates/Daily.md',
    openOnStartup: false,
  },
}
