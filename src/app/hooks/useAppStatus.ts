import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_CLEAR_MS = 5000
const ERROR_CLEAR_MS = 15000

export type AppStatusTone = 'neutral' | 'success' | 'info' | 'warning' | 'error'

export function inferStatusTone(message: string): AppStatusTone {
  const text = message.trim().toLowerCase()
  if (!text) return 'neutral'
  if (
    /(?:失败|失敗|failed|falha|error|conflict|冲突|衝突|unavailable|missing|不可用|cannot|could not|无法|無法|warning|警告)/iu.test(
      text,
    )
  ) {
    return /(?:warning|警告|冲突|衝突|conflict)/iu.test(text) ? 'warning' : 'error'
  }
  if (/(?:saved|保存|已保存|exported|导出|已导出|opened|打开|copied|复制|created|创建|renamed|重命名|refreshed|刷新)/iu.test(text)) {
    return 'success'
  }
  return 'neutral'
}

/** Transient status feedback (save success, errors). Clears after a few seconds; does not replace persistent footer state. */
export function useAppStatus(clearMs = DEFAULT_CLEAR_MS) {
  const [transientStatus, setTransientStatus] = useState('')
  const [transientTone, setTransientTone] = useState<AppStatusTone>('neutral')
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const setStatus = useCallback(
    (message: string, toneOverride?: AppStatusTone) => {
      const tone = toneOverride ?? inferStatusTone(message)
      setTransientStatus(message)
      setTransientTone(tone)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (!message) return
      timerRef.current = setTimeout(() => {
        setTransientStatus('')
        setTransientTone('neutral')
        timerRef.current = undefined
      }, tone === 'error' || tone === 'warning' ? ERROR_CLEAR_MS : clearMs)
    },
    [clearMs],
  )

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return { status: transientStatus, statusTone: transientTone, setStatus }
}
