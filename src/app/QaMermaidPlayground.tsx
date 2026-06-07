import { useCallback, useEffect, useRef, useState } from 'react'

import { I18nProvider } from '../i18n'
import { getEnMessagesSnapshot, getLocaleMessagesSnapshot, getLocaleRawSnapshot } from '../i18n/localeRegistry'
import {
  TiptapMarkdownEditor,
  type TiptapMarkdownEditorHandle,
} from '../editor/TiptapMarkdownEditor'
import { EditorOpenReason } from '../editor/editorOpenReason'
import { markAppSettingsHydratedForTests } from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'

const QA_INITIAL_MARKDOWN = `# Mermaid QA

\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`
`

declare global {
  interface Window {
    __QA_MERMAID__?: {
      loadMarkdown: (markdown: string) => void
      getMarkdown: () => string
      getBlockMode: () => string | null
      getSourceValue: () => string
      svgText: () => string
      hasSvg: () => boolean
      hasConsoleErrors: () => boolean
    }
  }
}

const QA_DOCUMENT_KEY = 'qa:mermaid'
const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

const QA_APP_SETTINGS = { ...DEFAULT_APP_SETTINGS, language: 'en' as const }

function queryMermaidShell(): HTMLElement | null {
  return document.querySelector('.qa-mermaid-shell .code-block--mermaid')
}

function QaMermaidInner() {
  markAppSettingsHydratedForTests(QA_APP_SETTINGS)

  const editorRef = useRef<TiptapMarkdownEditorHandle>(null)
  const [docKey, setDocKey] = useState(`${QA_DOCUMENT_KEY}:0`)
  const [markdown, setMarkdown] = useState(QA_INITIAL_MARKDOWN)
  const [status, setStatus] = useState('booting')
  const consoleErrorsRef = useRef<string[]>([])

  const loadMarkdown = useCallback((next: string) => {
    consoleErrorsRef.current = []
    setDocKey(`${QA_DOCUMENT_KEY}:${Date.now()}`)
    setMarkdown(next)
  }, [])

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      consoleErrorsRef.current.push(event.message)
    }
    window.addEventListener('error', onError)
    return () => window.removeEventListener('error', onError)
  }, [])

  useEffect(() => {
    window.__QA_MERMAID__ = {
      loadMarkdown,
      getMarkdown: () => editorRef.current?.getMarkdown(true) ?? markdown,
      getBlockMode: () => queryMermaidShell()?.getAttribute('data-code-block-mode') ?? null,
      getSourceValue: () =>
        (document.querySelector('.qa-mermaid-shell .pm-mermaid-source-panel') as HTMLTextAreaElement | null)
          ?.value ?? '',
      svgText: () =>
        document.querySelector('.qa-mermaid-shell .pm-mermaid-svg-host svg')?.textContent?.trim() ?? '',
      hasSvg: () => Boolean(document.querySelector('.qa-mermaid-shell .pm-mermaid-svg-host svg')),
      hasConsoleErrors: () => consoleErrorsRef.current.length > 0,
    }
    setStatus('ready')
    return () => {
      delete window.__QA_MERMAID__
    }
  }, [loadMarkdown, markdown])

  return (
    <div style={{ padding: 24, background: '#0f1115', minHeight: '100vh' }}>
      <h1 data-testid="qa-ready">Mermaid QA</h1>
      <p data-testid="qa-status">{status}</p>
      <div
        className="preview-pane markdown-visual-editor qa-mermaid-shell"
        style={{ maxWidth: 980 }}
      >
        <TiptapMarkdownEditor
          ref={editorRef}
          documentKey={docKey}
          markdown={markdown}
          activePath="qa/mermaid.md"
          rootDir=""
          sidebarListMode="outline"
          onMarkdownChange={() => {}}
          onActiveHeadingChange={() => {}}
          onSelectionActivity={() => {}}
          onStatus={() => {}}
          onOutlineHeadingsChange={() => {}}
          onPasteImage={async () => null}
          openReason={EditorOpenReason.ColdOpen}
        />
      </div>
    </div>
  )
}

export function QaMermaidPlayground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaMermaidInner />
    </I18nProvider>
  )
}
