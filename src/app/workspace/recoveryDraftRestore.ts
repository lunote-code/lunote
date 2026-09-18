import { parseFrontmatter } from '../../editor/knowledgeRuntime/wikiLinkParser'
import { normalizeLineEndings } from '../../lib/normalizeLineEndings'

export type RecoveryDraftSnapshot = {
  content: string
  updatedAt: number
}

function recoveryCompareSurface(markdown: string): string {
  // Drafts may be body-only (legacy) or full disk markdown — compare edit bodies.
  return normalizeLineEndings(parseFrontmatter(markdown).body)
}

export function shouldRestoreRecoveryDraft(args: {
  draft: RecoveryDraftSnapshot
  diskContent?: string | null
  diskModifiedSecs?: number | null
}): boolean {
  const { draft, diskContent, diskModifiedSecs } = args
  if (typeof draft.content !== 'string') return false
  if (
    typeof diskContent === 'string' &&
    recoveryCompareSurface(draft.content) === recoveryCompareSurface(diskContent)
  ) {
    return false
  }
  if (typeof diskModifiedSecs === 'number' && Number.isFinite(diskModifiedSecs)) {
    const diskModifiedMs = diskModifiedSecs * 1000
    if (diskModifiedMs > draft.updatedAt + 1000) {
      return false
    }
  }
  return true
}
