/** Menu actions that must use WebView native copy/cut/paste (not Tauri menu shortcuts or navigator.clipboard). */
export const NATIVE_WEBVIEW_CLIPBOARD_MENU_ACTIONS = new Set<string>([
  'edit-paste',
  'edit-copy',
  'edit-cut',
])
