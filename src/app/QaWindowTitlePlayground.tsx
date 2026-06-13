import { useCallback, useEffect, useMemo, useState } from 'react'

import { deriveWindowTitleParts } from '../platform/tauri/windowTitleModel'
import {
  buildWindowTitle,
  getLastTauriWindowTitleSync,
  syncTauriWindowTitle,
} from '../platform/tauri/windowTitleSync'
import { useSyncWindowTitle } from './hooks/useSyncWindowTitle'
import { APP_DISPLAY_NAME } from './workspace/constants'

const QA_ROOT = '/qa-vault'
const QA_DOC = `${QA_ROOT}/新笔记.md`

declare global {
  interface Window {
    __QA_WINDOW_TITLE__?: {
      getDocumentTitle: () => string
      getWorkspaceTitle: () => string
      getFormattedTitle: () => string
      getLastSync: () => ReturnType<typeof getLastTauriWindowTitleSync>
    }
  }
}

function tabLabel(path: string): string {
  if (!path.startsWith(QA_ROOT)) return path.replace(/\\/g, '/').split('/').pop() ?? path
  return path.slice(QA_ROOT.length + 1).replace(/\\/g, '/')
}

export function QaWindowTitlePlayground() {
  const [activePath, setActivePath] = useState(QA_DOC)
  const [rootDir, setRootDir] = useState(QA_ROOT)

  const workspaceFolderName = useMemo(() => {
    const norm = rootDir.replace(/[/\\]+$/u, '')
    return norm.split(/[/\\]/u).pop() ?? 'qa-vault'
  }, [rootDir])

  const { documentTitle, workspaceTitle } = useMemo(
    () =>
      deriveWindowTitleParts({
        activePath,
        rootDir,
        tabLabel,
        workspaceFolderName,
      }),
    [activePath, rootDir, workspaceFolderName],
  )

  useSyncWindowTitle(documentTitle, workspaceTitle, APP_DISPLAY_NAME)

  const formattedTitle = useMemo(
    () => buildWindowTitle(documentTitle, workspaceTitle, APP_DISPLAY_NAME),
    [documentTitle, workspaceTitle],
  )

  const publishQaApi = useCallback(() => {
    window.__QA_WINDOW_TITLE__ = {
      getDocumentTitle: () => documentTitle,
      getWorkspaceTitle: () => workspaceTitle,
      getFormattedTitle: () => formattedTitle,
      getLastSync: () => getLastTauriWindowTitleSync(),
    }
  }, [documentTitle, workspaceTitle, formattedTitle])

  useEffect(() => {
    publishQaApi()
    return () => {
      delete window.__QA_WINDOW_TITLE__
    }
  }, [publishQaApi])

  return (
    <div className="qa-window-title-root">
      <p data-testid="qa-ready">Window title QA</p>
      <p data-testid="qa-window-title-formatted">{formattedTitle}</p>
      <p data-testid="qa-window-title-document">{documentTitle}</p>
      <p data-testid="qa-window-title-workspace">{workspaceTitle}</p>
      <button type="button" data-testid="qa-open-document" onClick={() => setActivePath(QA_DOC)}>
        Open document
      </button>
      <button type="button" data-testid="qa-close-document" onClick={() => setActivePath('')}>
        Close document
      </button>
      <button
        type="button"
        data-testid="qa-clear-workspace"
        onClick={() => {
          setRootDir('')
          setActivePath('')
        }}
      >
        Clear workspace
      </button>
      <button
        type="button"
        data-testid="qa-resync-title"
        onClick={() => void syncTauriWindowTitle(documentTitle, workspaceTitle, APP_DISPLAY_NAME)}
      >
        Resync title
      </button>
    </div>
  )
}
