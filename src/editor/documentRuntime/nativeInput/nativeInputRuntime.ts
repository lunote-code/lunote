import { claimNativeInputAuthority, releaseNativeInputAuthority } from './nativeInputAuthority'
import type { NativeInputRegistration } from './nativeInputRegistry'
import {
  getNativeInputRegistration,
  registerNativeInput,
  unregisterNativeInput,
  type NativeInputType,
} from './nativeInputRegistry'

export type NativeInputFocusState = {
  inputId: string
  blockId: string | null
  type: NativeInputType
  composing: boolean
}

let active: NativeInputFocusState | null = null

export function getActiveNativeInputId(): string | null {
  return active?.inputId ?? null
}

export function getNativeInputFocusState(): Readonly<NativeInputFocusState> | null {
  return active
}

export function isNativeInputActive(): boolean {
  return active != null
}

export function isNativeInputComposing(): boolean {
  return active?.composing ?? false
}

export function shouldRuntimeYieldToNativeInput(blockId?: string | null): boolean {
  if (!active) return false
  if (blockId == null) return false
  return active.blockId == null || active.blockId === blockId
}

export function mountNativeInput(args: {
  type: NativeInputType
  dom: HTMLElement
  blockId?: string | null
  id?: string
}): string {
  return registerNativeInput({
    id: args.id,
    type: args.type,
    dom: args.dom,
    blockId: args.blockId,
  })
}

export function unmountNativeInput(inputId: string): void {
  if (active?.inputId === inputId) {
    deactivateNativeInput(inputId)
  }
  unregisterNativeInput(inputId)
}

export function activateNativeInput(inputId: string): void {
  const reg = getNativeInputRegistration(inputId)
  if (!reg) return
  active = {
    inputId: reg.id,
    blockId: reg.blockId ?? null,
    type: reg.type,
    composing: false,
  }
  claimNativeInputAuthority(inputId)
}

export function deactivateNativeInput(inputId: string): void {
  if (active?.inputId !== inputId) return
  active = null
  releaseNativeInputAuthority(inputId)
}

export function setNativeInputComposing(inputId: string, composing: boolean): void {
  if (active?.inputId !== inputId) return
  active = { ...active, composing }
}

export function getActiveNativeInputRegistration(): NativeInputRegistration | undefined {
  if (!active) return undefined
  return getNativeInputRegistration(active.inputId)
}

export function resetNativeInputRuntime(): void {
  if (active) releaseNativeInputAuthority(active.inputId)
  active = null
}
