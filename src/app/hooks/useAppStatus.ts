import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_CLEAR_MS = 5000

/** Application status bar message: used for both screen reading and visible footer, automatically cleared after a few seconds*/
export function useAppStatus(clearMs = DEFAULT_CLEAR_MS) {
  const [status, setStatusState] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const setStatus = useCallback(
    (message: string) => {
      setStatusState(message)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (!message) return
      timerRef.current = setTimeout(() => {
        setStatusState('')
        timerRef.current = undefined
      }, clearMs)
    },
    [clearMs],
  )

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return { status, setStatus }
}
