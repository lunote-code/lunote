import { findNativeInputForTarget, getNativeInputByDom } from './nativeInputRegistry'

/** Built-in nested editor / native input root selector*/
export const NATIVE_INPUT_HOST_SELECTOR = [
  '[data-native-input-host]',
  '[data-native-text-input-host]',
  '[data-code-block-input]',
].join(', ')

export const NATIVE_INPUT_SELECTOR = [
  'textarea',
  'input:not([type=button]):not([type=submit]):not([type=reset]):not([type=checkbox]):not([type=radio])',
  '.code-block-input',
  '.pm-mermaid-source-panel',
  '.monaco-editor',
  '.cm-editor',
  '.cm-content',
  '.mathlive-editor',
  '.sandpack-editor',
  '[data-native-input]',
].join(', ')

function isTextLikeInput(el: HTMLElement): boolean {
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase()
    return !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'hidden', 'image'].includes(type)
  }
  if (el.isContentEditable) {
    return !!el.closest(
      `${NATIVE_INPUT_HOST_SELECTOR}, .monaco-editor, .cm-editor, .cm-content, [data-native-input]`,
    )
  }
  return false
}

export function isNativeInputTarget(target: EventTarget | null): boolean {
  if (!target) return false
  if (findNativeInputForTarget(target)) return true
  if (target instanceof HTMLElement) {
    if (isTextLikeInput(target)) return true
    return !!target.closest(NATIVE_INPUT_SELECTOR)
  }
  return false
}

/** @deprecated using isNativeInputTarget*/
export const isNativeTextInputElement = isNativeInputTarget

export function isNativeInputDom(el: HTMLElement | null): boolean {
  if (!el) return false
  if (getNativeInputByDom(el)) return true
  if (isTextLikeInput(el)) return true
  if (el.matches(NATIVE_INPUT_SELECTOR)) return true
  return !!el.closest(NATIVE_INPUT_SELECTOR)
}

/** @deprecated using isNativeInputDom*/
export const isNativeTextInputDom = isNativeInputDom

export function getNativeInputBoundaryRoot(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null
  const reg = getNativeInputByDom(el)
  if (reg) return reg.dom
  return el.closest<HTMLElement>(NATIVE_INPUT_HOST_SELECTOR) ?? el.closest<HTMLElement>(NATIVE_INPUT_SELECTOR)
}

export function isInsideNativeInputBoundary(el: HTMLElement | null): boolean {
  return isNativeInputDom(el)
}
