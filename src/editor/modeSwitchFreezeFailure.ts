/**
 * Semantic freeze failure: carries structured diagnostics for UI layer report/assert, and MUST NOT be used for any fallback compilation or projection recovery.
 */
export class ModeSwitchFreezeError extends Error {
  readonly detail: Readonly<Record<string, unknown>>

  constructor(message: string, detail: Record<string, unknown>) {
    super(message)
    this.name = 'ModeSwitchFreezeError'
    this.detail = Object.freeze({ ...detail })
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export function isModeSwitchFreezeError(err: unknown): err is ModeSwitchFreezeError {
  return err instanceof ModeSwitchFreezeError
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/**
 * toast equivalent: only `console.error` + structured payload, does not modify editor / snapshot / selection.
 */
export function reportModeSwitchFreezeFailure(
  err: unknown,
  ctx?: {
    documentKey?: string
    phase?: string
    failureKind?: string
    bridgeId?: string
    documentFingerprint?: string
    resultKind?: string
    qualitySummary?: Record<string, unknown> | null
  },
): void {
  const base = {
    documentKey: ctx?.documentKey,
    phase: ctx?.phase ?? 'freeze',
    failureKind: ctx?.failureKind ?? null,
    bridgeId: ctx?.bridgeId ?? null,
    documentFingerprint: ctx?.documentFingerprint ?? null,
    resultKind: ctx?.resultKind ?? null,
    qualitySummary: ctx?.qualitySummary ?? null,
  }
  if (isModeSwitchFreezeError(err)) {
    console.error('[mode-switch] freeze failure (semantic compiler)', base, err.detail, err)
    console.error('[mode-switch] freeze failure summary', {
      ...base,
      reason: err.detail.reason ?? null,
      blockIndex: err.detail.blockIndex ?? null,
      rowKey: err.detail.rowKey ?? null,
      blockType: err.detail.blockType ?? null,
      semanticExtent: err.detail.semanticExtent ?? null,
      bodySegLen: err.detail.bodySegLen ?? null,
      pmTokenCount: err.detail.pmTokenCount ?? null,
      mdTokenCount: err.detail.mdTokenCount ?? null,
      pmJoinLen: err.detail.pmJoinLen ?? null,
      mdJoinLen: err.detail.mdJoinLen ?? null,
      pmRowCount: err.detail.pmRowCount ?? null,
      mdRowCount: err.detail.mdRowCount ?? null,
    })
    if (err.detail.pmRows || err.detail.mdRows) {
      console.error('[mode-switch] freeze failure row diff', {
        pmRows: err.detail.pmRows ?? null,
        mdRows: err.detail.mdRows ?? null,
      })
    }
    console.error('[mode-switch] freeze failure body preview', String(err.detail.bodySegPreview ?? ''))
    console.error('[mode-switch] freeze failure pm tokens', safeStringify(err.detail.pmTokenDump ?? null))
    console.error('[mode-switch] freeze failure md tokens', safeStringify(err.detail.mdTokenDump ?? null))
    console.error('[mode-switch] freeze failure canonical excerpt', String(err.detail.canonicalExcerpt ?? ''))
  } else {
    console.error('[mode-switch] freeze failure', base, err)
  }
}

/**
 * DEV: Some mode-switch side effects must not occur after freeze abort (markdown / PM doc must not be changed before submission).
 */
export function assertNoPartialModeSwitchMutation(args: {
  markdownBefore: string
  markdownAfter: string
  pmDocUnchanged: boolean
}): void {
  if (!import.meta.env.DEV) return
  if (args.markdownBefore !== args.markdownAfter) {
    throw new Error(
      '[mode-switch] assertNoPartialModeSwitchMutation: markdown changed despite freeze abort (partial mutation)',
    )
  }
  if (!args.pmDocUnchanged) {
    throw new Error(
      '[mode-switch] assertNoPartialModeSwitchMutation: PM document changed despite freeze abort (partial mutation)',
    )
  }
}
