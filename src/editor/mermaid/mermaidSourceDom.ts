import { isMermaidSourcePortalTarget } from './mermaidSourceClipboard'
import { getInputFocusToken, isMermaidInputKernelActive } from './mermaidSourceInputFocus'

export { MERMAID_SOURCE_PORTAL_CLASS } from './MermaidSourceSession'

export function isMermaidSourceDomTarget(target: EventTarget | null): boolean {
  return isMermaidSourcePortalTarget(target)
}

/** When inputFocusToken is valid and activeElement is consistent with token, PM is completely passive*/
export function isMermaidSourceFocused(): boolean {
  if (typeof document === 'undefined') return false
  if (!isMermaidInputKernelActive()) return false

  const token = getInputFocusToken()
  if (!token) return false

  const el = document.activeElement
  if (!(el instanceof HTMLTextAreaElement)) return false
  if (!isMermaidSourcePortalTarget(el)) return false
  if (el.dataset.mermaidBlockId !== token.blockId) return false
  return Number(el.dataset.mermaidFocusId) === token.focusId
}

/** @deprecated using isMermaidSourceFocused*/
export const isMermaidSourceKeyboardActive = isMermaidSourceFocused
