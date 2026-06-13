/**
 * QA routes must mount production DOM hooks so Playwright (Vite dev) exercises
 * the same selectors/CSS as AppRoot — Tauri shell differences are covered separately.
 */
export type QaProductionParityRule = {
  route: string
  playgroundFile: string
  requiredInPlayground: readonly string[]
  requiredProductionComponents?: readonly string[]
  /** Routes that intentionally omit a full editor but must still use production chrome classes. */
  allowEditorStub?: boolean
}

export const QA_PRODUCTION_PARITY_RULES: readonly QaProductionParityRule[] = [
  {
    route: 'workspace-sidebar-selection',
    playgroundFile: 'src/app/QaWorkspaceSidebarSelectionPlayground.tsx',
    requiredInPlayground: ['AppSidebarPanel', 'layout workspace-split mod-root', 'EditorTabBar'],
    requiredProductionComponents: ['AppSidebarPanel', 'EditorTabBar'],
  },
  {
    route: 'first-run',
    playgroundFile: 'src/app/QaFirstRunPlayground.tsx',
    requiredInPlayground: [
      'AppSidebarPanel',
      'layout workspace-split mod-root',
      'editor-body-surface',
      'preview-pane markdown-visual-editor',
      'EditorTabBar',
    ],
    requiredProductionComponents: ['AppSidebarPanel', 'EditorTabBar', 'EmptyState'],
    allowEditorStub: true,
  },
  {
    route: 'knowledge',
    playgroundFile: 'src/app/QaKnowledgePlayground.tsx',
    requiredInPlayground: [
      'KnowledgeRightRail',
      'layout workspace-split mod-root',
      'editor-body-surface',
      'preview-pane',
      'markdown-visual-editor',
    ],
    requiredProductionComponents: ['KnowledgeRightRail'],
    allowEditorStub: true,
  },
  {
    route: 'document-editor',
    playgroundFile: 'src/app/QaDocumentEditorPlayground.tsx',
    requiredInPlayground: ['TiptapMarkdownEditor', 'preview-pane markdown-visual-editor'],
    requiredProductionComponents: ['TiptapMarkdownEditor'],
  },
  {
    route: 'startup',
    playgroundFile: 'src/app/QaStartupPlayground.tsx',
    requiredInPlayground: ['applyInitialThemeFromSettings', 'getWindowThemeSync'],
  },
] as const

/** Production paths that must never import experimental modules. */
export const PRODUCTION_IMPORT_GUARD_GLOBS = [
  'src/app/',
  'src/editor/knowledgeOS/',
  'src/platform/tauri/',
] as const
