import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { I18nProvider } from '../i18n'
import {
  getEnMessagesSnapshot,
  getLocaleMessagesSnapshot,
  getLocaleRawSnapshot,
} from '../i18n/localeRegistry'
import { pathsEqual } from '../lib/workspacePathUtils'
import { WorkspaceTree } from './components/WorkspaceTree'
import {
  QA_BULK_WORKSPACE_FILE_COUNT,
  QA_BULK_WORKSPACE_NOTES_DIR,
  QA_BULK_WORKSPACE_ROOT,
  buildQaBulkWorkspaceFilePath,
  buildQaBulkWorkspaceFilePaths,
  buildQaBulkWorkspaceTree,
} from './qaBulkWorkspaceFixtures'
import { countMarkdownInTree } from './workspace/workspaceTree'
const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

declare global {
  interface Window {
    __QA_BULK_WORKSPACE__?: {
      getWorkspaceRoot: () => string
      getFileCount: () => number
      getActivePath: () => string
      activateFile: (path: string) => void
      pathAtIndex: (index: number) => string
      countRenderedFileRows: () => number
      hasConsoleErrors: () => boolean
      getConsoleErrors: () => string[]
    }
  }
}

function QaBulkWorkspaceInner() {
  const [status, setStatus] = useState('ready')
  const [rootDir] = useState(QA_BULK_WORKSPACE_ROOT)
  const fileTree = useMemo(() => buildQaBulkWorkspaceTree(), [])
  const filePaths = useMemo(() => buildQaBulkWorkspaceFilePaths(), [])
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(
    () => new Set([QA_BULK_WORKSPACE_NOTES_DIR]),
  )
  const [activePath, setActivePath] = useState('')
  const consoleErrorsRef = useRef<string[]>([])
  const activePathRef = useRef(activePath)
  activePathRef.current = activePath

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const activateFile = useCallback((path: string) => {
    const target = path.trim()
    if (!target) return
    if (!filePaths.some((item) => pathsEqual(item, target))) return
    setActivePath(target)
    setStatus(`opened:${target.split('/').pop() ?? target}`)
  }, [filePaths])

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      consoleErrorsRef.current.push(event.message)
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason)
      consoleErrorsRef.current.push(reason)
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  useEffect(() => {
    window.__QA_BULK_WORKSPACE__ = {
      getWorkspaceRoot: () => rootDir,
      getFileCount: () => countMarkdownInTree(fileTree),
      getActivePath: () => activePathRef.current,
      activateFile,
      pathAtIndex: (index) => buildQaBulkWorkspaceFilePath(index),
      countRenderedFileRows: () =>
        document.querySelectorAll('.qa-bulk-workspace-shell [data-workspace-file-path]').length,
      hasConsoleErrors: () => consoleErrorsRef.current.length > 0,
      getConsoleErrors: () => [...consoleErrorsRef.current],
    }
    return () => {
      delete window.__QA_BULK_WORKSPACE__
    }
  }, [activateFile, fileTree, rootDir])

  return (
    <div className="qa-bulk-workspace-shell" style={{ display: 'flex', minHeight: '100vh' }}>
      <aside className="sidebar" data-workspace-sidebar style={{ width: 320, flexShrink: 0 }}>
        <div className="file-list">
          <WorkspaceTree
            nodes={fileTree}
            depth={0}
            rootDir={rootDir}
            expandedDirs={expandedDirs}
            onToggleDir={toggleDir}
            activePath={activePath}
            onFileClick={(_event, path) => activateFile(path)}
          />
        </div>
      </aside>
      <main style={{ flex: 1, padding: 24 }}>
        <h1 data-testid="qa-ready">Bulk Workspace QA</h1>
        <p data-testid="qa-status">{status}</p>
        <p data-testid="qa-workspace-root">{rootDir}</p>
        <p data-testid="qa-workspace-file-count">{QA_BULK_WORKSPACE_FILE_COUNT}</p>
        <p data-testid="qa-active-path">{activePath}</p>
      </main>
    </div>
  )
}

export function QaBulkWorkspacePlayground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaBulkWorkspaceInner />
    </I18nProvider>
  )
}
