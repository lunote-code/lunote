import { useEffect, useState } from 'react'

/** Show feedback only after `delayMs` so fast operations avoid loading chrome flash. */
export function useDelayedFeedback(active: boolean, delayMs: number): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }
    const timer = window.setTimeout(() => setVisible(true), delayMs)
    return () => window.clearTimeout(timer)
  }, [active, delayMs])

  return visible
}
