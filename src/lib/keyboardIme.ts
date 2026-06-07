import { useCallback, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

function isNativeImeComposing(e: KeyboardEvent): boolean {
  return e.isComposing || e.keyCode === 229 || e.key === 'Process'
}

/** Ignore Enter used to confirm IME composition (common for CJK input). */
export function useImeCompositionGuard() {
  const composingRef = useRef(false)
  const ignoreEnterRef = useRef(false)

  const onCompositionStart = useCallback(() => {
    composingRef.current = true
  }, [])

  const onCompositionEnd = useCallback(() => {
    composingRef.current = false
    ignoreEnterRef.current = true
  }, [])

  const shouldIgnoreEnter = useCallback((e: ReactKeyboardEvent) => {
    if (composingRef.current || isNativeImeComposing(e.nativeEvent)) return true
    if (ignoreEnterRef.current) {
      ignoreEnterRef.current = false
      return true
    }
    return false
  }, [])

  return { onCompositionStart, onCompositionEnd, shouldIgnoreEnter }
}
