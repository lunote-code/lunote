import { useLayoutEffect, type MutableRefObject } from 'react'

import type { AppMenuContext, AppMenuUiDeps } from '../../menu'

/** Each frame writes the latest menu context to ref for Tauri monitoring and command panel to read.*/
export function useSyncAppMenuContext(
  appMenuCtxRef: MutableRefObject<AppMenuContext>,
  paletteUiDepsRef: MutableRefObject<AppMenuUiDeps>,
  menuContext: AppMenuContext,
  paletteDeps: AppMenuUiDeps,
): void {
  useLayoutEffect(() => {
    appMenuCtxRef.current = menuContext
    paletteUiDepsRef.current = paletteDeps
  })
}
