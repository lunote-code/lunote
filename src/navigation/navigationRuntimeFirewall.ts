const LEGACY_GLOBALS = [
  'openNote',
  'openInTab',
  'kernelExecutorNavigate',
  'dispatchKnowledgeNavigate',
] as const

let installed = false
let factoryDepth = 0

function reportViolation(message: string, meta?: Record<string, unknown>): void {
  console.error('[NAV VIOLATION]', message, meta ?? {})
}

function wrapLegacyGlobalIfPresent(name: typeof LEGACY_GLOBALS[number]): void {
  if (typeof window === 'undefined') return
  const legacyFn = (window as unknown as Record<string, unknown>)[name]
  if (typeof legacyFn !== 'function') {
    return
  }
  ;(window as unknown as Record<string, unknown>)[name] = (...args: unknown[]) => {
    reportViolation('legacy API invocation detected. Use navigationFactory.', {
      apiName: name,
      argCount: args.length,
    })
    return (legacyFn as (...args: unknown[]) => unknown)(...args)
  }
}

export function assertNavigationFactoryOnly(): void {
  if (factoryDepth <= 0) {
    reportViolation('invalid navigation context')
  }
}

export function withNavigationFactoryContext<T>(fn: () => T): T {
  factoryDepth += 1
  try {
    return fn()
  } finally {
    factoryDepth = Math.max(0, factoryDepth - 1)
  }
}

export function validateNavigationEvent(event: { __source?: unknown }): void {
  if (event.__source !== 'navigationFactory') {
    reportViolation('invalid event origin', {
      source: event.__source,
    })
  }
}

export function installNavigationRuntimeFirewall(): void {
  if (installed) return
  installed = true
  try {
    if (typeof window !== 'undefined') {
      for (const name of LEGACY_GLOBALS) {
        wrapLegacyGlobalIfPresent(name)
      }
    }
    console.log('[NAV FIREWALL] installed', {
      legacyGlobals: LEGACY_GLOBALS,
      factoryOnlyDispatch: true,
      mode: 'detect-only',
    })
  } catch (error) {
    reportViolation('firewall install failed without blocking startup', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export function detectNavigationBypassAttempt(apiName: string): void {
  reportViolation('direct execution detected', {
    apiName,
    devCrashSuppressed: Boolean(import.meta.env.DEV),
  })
}
