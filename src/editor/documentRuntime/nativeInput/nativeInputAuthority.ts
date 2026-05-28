import type { AuthorityDomain } from '../runtimeAuthority'
import { getAuthority, setAuthority } from '../runtimeAuthority'
import { getActiveNativeInputId } from './nativeInputRuntime'

export const NATIVE_INPUT_AUTHORITY = 'native-input' as const

const NATIVE_AUTHORITY_DOMAINS: AuthorityDomain[] = [
  'selection',
  'focus',
  'viewport',
  'render',
  'layout',
]

let heldByInputId: string | null = null

export function claimNativeInputAuthority(inputId: string): void {
  heldByInputId = inputId
  for (const domain of NATIVE_AUTHORITY_DOMAINS) {
    setAuthority(domain, NATIVE_INPUT_AUTHORITY)
  }
}

export function releaseNativeInputAuthority(inputId: string): void {
  if (heldByInputId !== inputId) return
  heldByInputId = null
  setAuthority('selection', 'pm')
  setAuthority('focus', 'pm')
  setAuthority('layout', 'cbr')
  setAuthority('render', 'block-renderer')
  setAuthority('viewport', 'viewport')
}

export function isNativeInputAuthorityHeld(): boolean {
  return heldByInputId != null && getActiveNativeInputId() === heldByInputId
}

export function isNativeInputAuthoritySource(domain: AuthorityDomain): boolean {
  return getAuthority(domain) === NATIVE_INPUT_AUTHORITY
}

export function runtimeMayMutateDomain(domain: AuthorityDomain): boolean {
  if (!isNativeInputAuthorityHeld()) return true
  return getAuthority(domain) !== NATIVE_INPUT_AUTHORITY
}
