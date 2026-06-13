import { useEffect, useState } from 'react'

const PLUGIN_DETAIL_OVERLAY_QUERY = '(max-width: 900px)'

export function usePluginDetailOverlay(): boolean {
  const [overlay, setOverlay] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(PLUGIN_DETAIL_OVERLAY_QUERY).matches,
  )

  useEffect(() => {
    const media = window.matchMedia(PLUGIN_DETAIL_OVERLAY_QUERY)
    const onChange = () => setOverlay(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return overlay
}
