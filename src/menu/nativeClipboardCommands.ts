/** Menu actions that must use WebView native editing shortcuts (not Tauri menu accelerators). */
export const NATIVE_WEBVIEW_CLIPBOARD_MENU_ACTIONS = new Set<string>([
  'edit-paste',
  'edit-copy',
  'edit-cut',
  'edit-select-all',
])
