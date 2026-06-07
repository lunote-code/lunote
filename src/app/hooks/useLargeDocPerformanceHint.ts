import { useEffect, useRef } from 'react'
import type { AppStatusTone } from './useAppStatus'

type Params = {
  isLargeDoc: boolean
  activePath: string
  setStatus: (message: string, toneOverride?: AppStatusTone) => void
  t: (key: string) => string
}

export function useLargeDocPerformanceHint({ isLargeDoc, activePath, setStatus, t }: Params) {
  const prevActivePathRef = useRef('')

  useEffect(() => {
    if (!isLargeDoc || !activePath) return
    if (prevActivePathRef.current === activePath) return
    prevActivePathRef.current = activePath
    setStatus(t('app.status.perfLargeDocEnabled'), 'info')
  }, [activePath, isLargeDoc, setStatus, t])
}
