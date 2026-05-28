import { eachMenuBarLeaf } from './menu.builder'
import { APP_MENU_SCHEMA } from './menu.schema'
import { uiLabelKeyToShellKey } from './menu.shellKey'
import type { MenuLeaf } from './menu.types'

export type CompiledMenuLeaf = {
  actionId: string
  labelKey: string
  /** Tauri shell `menu` segment key; only top bar items rendered by Rust have a value*/
  shellKey: string | null
}

/** Shell items (theme/application menu, etc.) that exist in the Rust top bar but are not in the APP_MENU_SCHEMA top bar group*/
export const SHELL_ONLY_COMPILED: CompiledMenuLeaf[] = [
  { actionId: 'app-hide', labelKey: 'menu.native.app.hide', shellKey: 'native_app_hide' },
  { actionId: 'app-hide-others', labelKey: 'menu.native.app.hideOthers', shellKey: 'native_app_hide_others' },
  { actionId: 'app-show-all', labelKey: 'menu.native.app.showAll', shellKey: 'native_app_show_all' },
  { actionId: 'app-quit', labelKey: 'menu.native.app.quit', shellKey: 'native_app_quit' },
  { actionId: 'win-close', labelKey: 'menu.native.win.close', shellKey: 'native_win_close' },
  { actionId: 'theme-refresh-css-list', labelKey: 'menu.native.themeRefreshCss', shellKey: 'native_theme_refresh_css' },
  { actionId: 'theme-open-folder', labelKey: 'menu.native.themeOpenFolder', shellKey: 'native_theme_open_folder' },
]

function compileLeaf(leaf: MenuLeaf): CompiledMenuLeaf {
  return {
    actionId: leaf.action ?? leaf.id,
    labelKey: leaf.labelKey,
    shellKey: uiLabelKeyToShellKey(leaf.labelKey),
  }
}

/** All leaves + shell-only items compiled from schema*/
export function compileMenuFromSchema(): CompiledMenuLeaf[] {
  const fromSchema: CompiledMenuLeaf[] = []
  eachMenuBarLeaf(APP_MENU_SCHEMA.bar, (leaf) => {
    fromSchema.push(compileLeaf(leaf))
  })
  return [...fromSchema, ...SHELL_ONLY_COMPILED]
}

/** Rust top bar Edit menu P0 item (consistent with `app_menu.rs` edit subset)*/
export const RUST_EDIT_MENU_P0: readonly { actionId: string; labelKey: string; shellKey: string }[] = [
  { actionId: 'edit-undo', labelKey: 'menu.edit.undo', shellKey: 'edit_undo' },
  { actionId: 'edit-redo', labelKey: 'menu.edit.redo', shellKey: 'edit_redo' },
  { actionId: 'edit-cut', labelKey: 'menu.edit.cut', shellKey: 'edit_cut' },
  { actionId: 'edit-copy', labelKey: 'menu.edit.copy', shellKey: 'edit_copy' },
  { actionId: 'edit-paste', labelKey: 'menu.edit.paste', shellKey: 'edit_paste' },
  { actionId: 'edit-select-all', labelKey: 'menu.edit.selectAll', shellKey: 'edit_select_all' },
] as const

