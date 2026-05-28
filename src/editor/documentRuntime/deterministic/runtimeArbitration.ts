import type { AuthorityDomain, AuthoritySource } from '../runtimeAuthority'
import { getAuthority, setAuthority } from '../runtimeAuthority'

/** Higher wins in conflict */
const AUTHORITY_PRECEDENCE: Record<AuthoritySource, number> = {
  'native-input': 200,
  user: 100,
  pm: 80,
  'block-textarea': 70,
  cbr: 60,
  collab: 50,
  viewport: 40,
  'block-renderer': 30,
}

type ConflictRequest = {
  domain: AuthorityDomain
  incoming: AuthoritySource
  blockId?: string | null
}

export function arbitrateAuthority(req: ConflictRequest): AuthoritySource {
  const current = getAuthority(req.domain)
  const curScore = AUTHORITY_PRECEDENCE[current] ?? 0
  const incScore = AUTHORITY_PRECEDENCE[req.incoming] ?? 0

  if (incScore >= curScore) {
    setAuthority(req.domain, req.incoming)
    return req.incoming
  }
  return current
}

export function arbitrateCrossRuntime(args: {
  selection?: AuthoritySource
  layout?: AuthoritySource
  focus?: AuthoritySource
  render?: AuthoritySource
  viewport?: AuthoritySource
  blockId?: string | null
}): void {
  if (args.selection) arbitrateAuthority({ domain: 'selection', incoming: args.selection, blockId: args.blockId })
  if (args.layout) arbitrateAuthority({ domain: 'layout', incoming: args.layout, blockId: args.blockId })
  if (args.focus) arbitrateAuthority({ domain: 'focus', incoming: args.focus, blockId: args.blockId })
  if (args.render) arbitrateAuthority({ domain: 'render', incoming: args.render, blockId: args.blockId })
  if (args.viewport) arbitrateAuthority({ domain: 'viewport', incoming: args.viewport, blockId: args.blockId })
}
