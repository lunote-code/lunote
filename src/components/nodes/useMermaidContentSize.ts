import { useLayoutEffect, useState, type RefObject } from 'react'

import { measureMermaidSvgHost, type MermaidContentSize } from './mermaidPreviewStage'

export function useMermaidContentSize(
  hostRef: RefObject<HTMLDivElement | null>,
  revision: string,
): MermaidContentSize | null {
  const [size, setSize] = useState<MermaidContentSize | null>(null)

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) {
      setSize(null)
      return
    }

    const measure = () => {
      setSize(measureMermaidSvgHost(host))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    const svg = host.querySelector('svg')
    if (svg) observer.observe(svg)

    return () => observer.disconnect()
  }, [hostRef, revision])

  return size
}
