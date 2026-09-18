export type InvalidateEditorBootstrapOptions = {
  /** When false, only reset mode-switch bootstrap; path change already remounts the editor. */
  bumpColdOpen?: boolean
}

/** Invalidate editor bootstrap state immediately before applying a cold document read to the active editor. */
export function invalidateEditorBootstrapBeforeDocumentRead(
  resetModeSwitchEditorBootstrap: () => void,
  bumpColdOpenGeneration: () => void,
  options: InvalidateEditorBootstrapOptions = {},
): void {
  resetModeSwitchEditorBootstrap()
  if (options.bumpColdOpen !== false) {
    bumpColdOpenGeneration()
  }
}
