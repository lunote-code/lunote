import { useCallback, useEffect, useRef, useState } from 'react'

import { I18nProvider } from '../i18n'
import {
  getEnMessagesSnapshot,
  getLocaleMessagesSnapshot,
  getLocaleRawSnapshot,
} from '../i18n/localeRegistry'
import { pathSetHas } from '../lib/workspacePathUtils'
import { WorkspaceTree } from './components/WorkspaceTree'
import type { FsTreeNode } from './workspace/types'

const QA_ROOT = '/qa-vault'

const QA_TREE: FsTreeNode[] = [
  {
    name: 'empty-folder',
    path: `${QA_ROOT}/empty-folder`,
    kind: 'dir',
    children: [],
  },
  {
    name: 'nested-empty',
    path: `${QA_ROOT}/nested-empty`,
    kind: 'dir',
    children: [
      {
        name: 'sub',
        path: `${QA_ROOT}/nested-empty/sub`,
        kind: 'dir',
        children: [],
      },
    ],
  },
  {
    name: 'notes',
    path: `${QA_ROOT}/notes`,
    kind: 'dir',
    children: [
      {
        name: 'hello.md',
        path: `${QA_ROOT}/notes/hello.md`,
        kind: 'file',
        children: [],
      },
    ],
  },
]

const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

declare global {
  interface Window {
    __QA_WORKSPACE_TREE__?: {
      isExpanded: (folderPath: string) => boolean
      toggleDir: (folderPath: string) => void
    }
  }
}

function QaWorkspaceTreeInner() {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set([`${QA_ROOT}/notes`]))
  const expandedDirsRef = useRef(expandedDirs)
  expandedDirsRef.current = expandedDirs

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  useEffect(() => {
    window.__QA_WORKSPACE_TREE__ = {
      isExpanded: (folderPath) => pathSetHas(expandedDirsRef.current, folderPath),
      toggleDir,
    }
    return () => {
      delete window.__QA_WORKSPACE_TREE__
    }
  }, [toggleDir])

  return (
    <>
      <aside className="sidebar qa-workspace-tree-shell" data-workspace-sidebar>
        <div className="file-list">
          <WorkspaceTree
            nodes={QA_TREE}
            depth={0}
            rootDir={QA_ROOT}
            expandedDirs={expandedDirs}
            onToggleDir={toggleDir}
            activePath=""
          />
        </div>
      </aside>
      <p data-testid="qa-ready">Workspace tree QA</p>
    </>
  )
}

export function QaWorkspaceTreePlayground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaWorkspaceTreeInner />
    </I18nProvider>
  )
}
