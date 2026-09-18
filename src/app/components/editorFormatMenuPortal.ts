export const EDITOR_FORMAT_MENU_PORTAL_SELECTOR =
  '.editor-format-callout-menu, .editor-format-text-color-menu'

export function isEditorFormatMenuPortalNode(node: Node | null | undefined): boolean {
  return node instanceof Element && Boolean(node.closest(EDITOR_FORMAT_MENU_PORTAL_SELECTOR))
}
