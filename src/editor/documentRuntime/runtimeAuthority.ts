export type AuthorityDomain = 'selection' | 'layout' | 'focus' | 'render' | 'viewport'

export type AuthoritySource =
  | 'native-input'
  | 'pm'
  | 'cbr'
  | 'block-textarea'
  | 'block-renderer'
  | 'viewport'
  | 'collab'
  | 'user'

type AuthorityState = {
  selection: AuthoritySource
  layout: AuthoritySource
  focus: AuthoritySource
  render: AuthoritySource
  viewport: AuthoritySource
}

const authority: AuthorityState = {
  selection: 'pm',
  layout: 'cbr',
  focus: 'pm',
  render: 'block-renderer',
  viewport: 'viewport',
}

export function getAuthority(domain: AuthorityDomain): AuthoritySource {
  return authority[domain]
}

export function setAuthority(domain: AuthorityDomain, source: AuthoritySource): void {
  authority[domain] = source
}

export function isAuthority(domain: AuthorityDomain, source: AuthoritySource): boolean {
  return authority[domain] === source
}
