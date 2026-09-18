import type { MutableRefObject, RefObject } from 'react'

import type { TranslateFn } from '../../i18n'
import { useDocumentKernelEffects } from '../hooks/useDocumentKernelEffects'
import type { AppEditorSessionRefs } from '../hooks/useAppEditorSessionRefs'
import type { AppStatusTone } from '../hooks/useAppStatus'

export type DocumentKernelRuntimeParams = {
  rootDir: string
  rootDirRef: MutableRefObject<string>
  activePathRef: RefObject<string>
  contentRef: RefObject<string>
  focusActiveEditor: () => void
  updateRecent: (path: string) => void
  logModeSwitchState: (phase: string) => void
  setStatus: (msg: string, toneOverride?: AppStatusTone) => void
  showAppAlert: (opts: { title: string; message: string; okLabel?: string }) => Promise<void>
  t: TranslateFn
  sessionRefs: Pick<
    AppEditorSessionRefs,
    'fileStatRef' | 'fileStatGenerationRef' | 'resetModeSwitchEditorBootstrap' | 'bumpColdOpenGeneration'
  >
}

/** Document kernel capabilities + projections wired from AppRoot session refs. */
export function useDocumentKernelRuntime(params: DocumentKernelRuntimeParams): void {
  const {
    rootDir,
    rootDirRef,
    activePathRef,
    contentRef,
    focusActiveEditor,
    updateRecent,
    logModeSwitchState,
    setStatus,
    showAppAlert,
    t,
    sessionRefs,
  } = params

  useDocumentKernelEffects({
    rootDir,
    rootDirRef,
    fileStatRef: sessionRefs.fileStatRef,
    fileStatGenerationRef: sessionRefs.fileStatGenerationRef,
    activePathRef,
    contentRef,
    focusActiveEditor,
    resetModeSwitchEditorBootstrap: sessionRefs.resetModeSwitchEditorBootstrap,
    bumpColdOpenGeneration: sessionRefs.bumpColdOpenGeneration,
    updateRecent,
    logModeSwitchState,
    setStatus,
    showAppAlert,
    t,
  })
}
