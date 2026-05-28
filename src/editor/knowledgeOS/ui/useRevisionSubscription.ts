import { useEffect, useRef, useState } from 'react'

const DEFAULT_DEBOUNCE_MS = 80

/**
 * Anti-shake revision subscription to avoid panel flicker caused by continuous runtime emit.
 */
export function useRevisionSubscription(
  subscribe: (listener: () => void) => () => void,
  debounceMs = DEFAULT_DEBOUNCE_MS,
): number {
  const [revision, setRevision] = useState(0)
  const debounceMsRef = useRef(debounceMs)
  debounceMsRef.current = debounceMs

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const flush = () => {
      timer = null
      setRevision((r) => r + 1)
    }
    const unsub = subscribe(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, debounceMsRef.current)
    })
    return () => {
      unsub()
      if (timer) clearTimeout(timer)
    }
  }, [subscribe])

  return revision
}

/**
 * Read the runtime snapshot; only get it again when the revision changes for panel use.
 */
export function useRuntimeSnapshot<T>(
  subscribe: (listener: () => void) => () => void,
  read: () => T,
  debounceMs = DEFAULT_DEBOUNCE_MS,
): T {
  const revision = useRevisionSubscription(subscribe, debounceMs)
  const cacheRef = useRef<{ revision: number; value: T } | null>(null)
  if (!cacheRef.current || cacheRef.current.revision !== revision) {
    cacheRef.current = { revision, value: read() }
  }
  return cacheRef.current.value
}
