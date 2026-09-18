import { resolveDocKey } from '../../knowledgeRuntime'
import type { WikiLinkTarget } from '../../knowledgeRuntime/types'
import { docKeyToAbsolutePath, getKnowledgeVaultRoot } from '../../knowledgeOS/vaultRuntime'
import { resolveWikiTarget } from '../../knowledgeOS/wikiLinkRuntime'
import { resolveWorkspaceMarkdownHref } from '../../resolveWorkspaceMarkdownHref'
import { decodeAiWikiLinkPayload } from '../render/preprocessAiWikiLinks'

function decodeHrefPart(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function splitHrefPathAndFragment(href: string): { pathPart: string; fragment: string } {
  const hashIdx = href.indexOf('#')
  if (hashIdx < 0) return { pathPart: href, fragment: '' }
  const pathPart = href.slice(0, hashIdx)
  let fragment: string
  try {
    fragment = decodeURIComponent(href.slice(hashIdx + 1)).trim()
  } catch {
    fragment = href.slice(hashIdx + 1).trim()
  }
  return { pathPart, fragment }
}

function resolveDocKeyFromLinkQueries(...queries: Array<string | null | undefined>): WikiLinkTarget | null {
  for (const query of queries) {
    const decoded = decodeHrefPart((query ?? '').trim())
    if (!decoded) continue
    const withoutExtension = decoded.replace(/\.md$/iu, '')
    for (const candidate of [decoded, withoutExtension]) {
      const docKey = resolveDocKey(candidate)
      if (docKey) return { docKey }
    }
  }
  return null
}

/** Resolve wiki-style assistant links (`[[note]]` → `ai-wiki-link`). */
export function resolveAiAssistantWikiLinkTarget(
  encoded: string | null,
  linkText: string,
): WikiLinkTarget | null {
  const decoded = encoded ? decodeAiWikiLinkPayload(encoded) : null
  if (decoded) {
    const resolved = resolveWikiTarget(decoded)
    if (resolved.resolvedDocKey) {
      return {
        docKey: resolved.resolvedDocKey,
        heading: resolved.rawTarget.heading,
        blockId: resolved.rawTarget.blockId,
      }
    }
  }
  return resolveDocKeyFromLinkQueries(linkText, decoded?.docKey)
}

/** Resolve markdown assistant links (`[title](target)`). */
export function resolveAiAssistantMarkdownLinkTarget(
  href: string,
  linkText: string,
  activeDocKey: string | null,
): WikiLinkTarget | null {
  const trimmedHref = href.trim()
  if (!trimmedHref || trimmedHref === '#') return null

  const { pathPart, fragment } = splitHrefPathAndFragment(trimmedHref)
  const rootDir = getKnowledgeVaultRoot() ?? ''
  if (rootDir && activeDocKey) {
    const notePath = docKeyToAbsolutePath(activeDocKey, rootDir)
    const resolved = resolveWorkspaceMarkdownHref(pathPart || trimmedHref, notePath, rootDir)
    if (resolved?.kind === 'workspace-note') {
      return {
        docKey: resolved.docKey,
        heading: resolved.fragment ?? (fragment || undefined),
      }
    }
  }

  const fromRegistry = resolveDocKeyFromLinkQueries(pathPart || trimmedHref, linkText)
  if (!fromRegistry) return null
  if (fragment) return { ...fromRegistry, heading: fragment }
  return fromRegistry
}
