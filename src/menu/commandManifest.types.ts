/** Standardized command grouping (palette/toolbar/audit)*/
export type CommandGroup =
  | 'file'
  | 'edit'
  | 'formatting'
  | 'insert'
  | 'paragraph'
  | 'view'
  | 'window'
  | 'navigation'
  | 'system'

export type CommandRuntimeKind =
  | 'menu'          // Go executeManifestCommand → resolveCommand → Transaction VM (no raw dispatch fallback)
  | 'noop'          //Explicitly declared as no-op (the function is not implemented / not applicable to the current platform)
  | 'app-save'
  | 'app-save-as'
  | 'app-close-tab'
  | 'app-close-window'
  | 'app-quit'
  | 'app-preferences'
  | 'app-focus-mode'
  | 'app-mode-toggle'
  | 'shell-only'

/** UI delivery surface: handwriting label / icon / shortcut inside the component is prohibited*/
export type CommandUiMeta = {
  /** Appears in the top bar menu tree*/
  menu?: boolean
  /** appears in the command panel*/
  palette?: boolean
  paletteKeywords?: string[]
  paletteHint?: string
  /** Appears in editor/sidebar toolbar*/
  toolbar?: boolean
  /** Toolbar slot id*/
  toolbarSlot?: 'sidebar-header' | 'editor-format'
}

export type CommandManifestEntry = {
  readonly id: string
  readonly labelKey: string
  readonly icon?: string
  readonly accelerator?: string
  readonly group: CommandGroup
  readonly runtime: CommandRuntimeKind
  readonly action?: string
  readonly ui: CommandUiMeta
  readonly nativeAcceleratorExcluded?: boolean
}

export type MenuTreeNode =
  | { kind: 'separator' }
  | { kind: 'command'; id: string }
  | { kind: 'submenu'; id: string; labelKey: string; children: MenuTreeNode[] }

export type MenuBarStructureGroup = {
  id: string
  labelKey: string
  children: MenuTreeNode[]
}

export type ToolbarSlotId = 'sidebar-header' | 'editor-format'

export type ToolbarLayout = Record<ToolbarSlotId, readonly string[]>

export type ResolvedCommandView = {
  id: string
  action: string
  label: string
  icon?: string
  shortcut?: string
  group: CommandGroup
  hint?: string
  keywords: string[]
}
