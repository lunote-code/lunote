export type DocumentRuntimeSnapshot = {
  rootDir: string
  activePath: string
  content: string
  openedTabs: string[]
  dirtyByPath: Record<string, boolean>
  updatedAt: number
}

export type DocumentCommand =
  | {
    type: 'OPEN_DOCUMENT'
    root: string
    path: string
    source?: string
    traceId?: string
  }
  | {
    type: 'OPEN_DOCUMENT_IN_TAB'
    root: string
    path: string
    source?: string
    traceId?: string
  }
  | {
    type: 'OPEN_DOCUMENT_REVEAL'
    root: string
    path: string
    docKey?: string
    heading?: string
    blockId?: string
    source?: string
    traceId?: string
  }
  | {
    type: 'DOCUMENT_CONTENT_CHANGED'
    path: string
    content: string
    source?: string
  }
  | {
    /**
     * Update an already-open document without forcing it active.
     * Used for background cache sync / authority-aligned mutations.
     */
    type: 'UPDATE_OPEN_DOCUMENT_CONTENT'
    path: string
    content: string
    source?: string
  }
  | {
    /** Normalize in-memory content while preserving the disk-backed dirty baseline. */
    type: 'NORMALIZE_DOCUMENT_CONTENT'
    path: string
    content: string
    source?: string
  }
  | {
    type: 'SAVE_DOCUMENT'
    root: string
    path: string
    content: string
    source?: string
    forceOverwrite?: boolean
  }
  | {
    type: 'SAVE_DOCUMENT_BATCH'
    root: string
    documents: Array<{
      path: string
      content: string
    }>
    source?: string
    forceOverwrite?: boolean
  }
  | {
    type: 'SET_TABS'
    tabs: string[]
    activePath?: string
    source?: string
  }
  | {
    type: 'RESTORE_WORKSPACE'
    root: string
    activePath: string | null
    openTabs: string[]
    emptyContent?: string
    source?: string
  }
  | {
    type: 'OPEN_SCRATCH_DOCUMENT'
    id: string
    content: string
    source?: string
  }
  | {
    type: 'OPEN_SCRATCH_TAB'
    id: string
    content: string
    currentPath?: string
    source?: string
  }
  | {
    type: 'CLOSE_TAB'
    path: string
    fallbackPath?: string
    fallbackContent?: string
    source?: string
  }
  | {
    type: 'REPLACE_ACTIVE_DOCUMENT'
    path: string
    content: string
    source?: string
  }
  | {
    type: 'REVERT_DOCUMENT'
    root: string
    path: string
    source?: string
  }
  | {
    type: 'ASSET_IMPORTED'
    documentPath: string
    assetIds: string[]
    content: string
    workspaceId: string
    source?: string
  }

export type DocumentEvent =
  | {
    type: 'DocumentOpened'
    path: string
    content: string
    root: string
    source?: string
    timestamp: number
  }
  | {
    type: 'DocumentRevealRequested'
    root: string
    path: string
    docKey?: string
    heading?: string
    blockId?: string
    content: string
    source?: string
    traceId?: string
    timestamp: number
  }
  | {
    type: 'DocumentContentChanged'
    path: string
    content: string
    source?: string
    timestamp: number
  }
  | {
    type: 'DocumentSaved'
    path: string
    content: string
    root: string
    source?: string
    timestamp: number
  }
  | {
    type: 'TabsChanged'
    tabs: string[]
    activePath?: string
    source?: string
    timestamp: number
  }
  | {
    type: 'WorkspaceRestored'
    root: string
    activePath: string | null
    openTabs: string[]
    source?: string
    timestamp: number
  }
  | {
    type: 'AssetImported'
    documentPath: string
    assetIds: string[]
    content: string
    workspaceId: string
    source?: string
    timestamp: number
  }

export type DocumentRuntimeCapabilities = {
  readDocument: (root: string, path: string) => Promise<string>
  /** Raw disk read for diagnostics; must not trigger UI side effects. */
  readDocumentForVerify?: (root: string, path: string) => Promise<string>
  writeDocument: (
    root: string,
    path: string,
    content: string,
    options?: { expectedModifiedSecs?: number; forceOverwrite?: boolean },
  ) => Promise<void>
  setActiveDocument: (path: string, content: string) => void
  renderContent: (content: string) => void
  setTabs: (tabs: string[] | ((prev: string[]) => string[])) => void
  onDocumentOpened?: (root: string, path: string, content: string) => void
  onDocumentSaved?: (root: string, path: string, content: string) => void
  onAfterOpen?: (path: string, content: string) => void
}
