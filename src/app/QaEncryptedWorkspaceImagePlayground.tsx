import { useEffect, useRef } from 'react'

import '../App.css'
import { I18nProvider } from '../i18n'
import {
  getEnMessagesSnapshot,
  getLocaleMessagesSnapshot,
  getLocaleRawSnapshot,
} from '../i18n/localeRegistry'
import {
  TiptapMarkdownEditor,
  type TiptapMarkdownEditorHandle,
} from '../editor/TiptapMarkdownEditor'
import { EditorOpenReason } from '../editor/editorOpenReason'
import { markAppSettingsHydratedForTests } from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'
import {
  resetWorkspaceImageObjectUrlCacheForTests,
  setReadWorkspaceFileBase64OverrideForTests,
} from '../export/workspaceMediaBlob'

const QA_ROOT = '/qa-vault'
const QA_NOTE = `${QA_ROOT}/notes/day.md`
const QA_IMAGE_SRC = './note.assets/encrypted-test.png'

/** 1×1 PNG used to simulate decrypted workspace image bytes. */
export const QA_ENCRYPTED_WORKSPACE_IMAGE_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

declare global {
  interface Window {
    __QA_ENCRYPTED_WORKSPACE_IMAGE__?: {
      getReadCallCount: () => number
      getLastReadPath: () => string | null
      probeRenderedImage: () => {
        src: string
        isBlobUrl: boolean
        loadFailed: boolean
        pending: boolean
      }
    }
  }
}

function QaEncryptedWorkspaceImageInner() {
  const editorRef = useRef<TiptapMarkdownEditorHandle | null>(null)
  const readCallCountRef = useRef(0)
  const lastReadPathRef = useRef<string | null>(null)

  useEffect(() => {
    window.__LUNA_TEST_WORKSPACE_MEDIA_DECRYPT__ = true
    setReadWorkspaceFileBase64OverrideForTests(async (_root, path) => {
      readCallCountRef.current += 1
      lastReadPathRef.current = path
      if (path.endsWith('encrypted-test.png')) {
        return QA_ENCRYPTED_WORKSPACE_IMAGE_B64
      }
      throw new Error('WORKSPACE_LOCKED')
    })

    window.__QA_ENCRYPTED_WORKSPACE_IMAGE__ = {
      getReadCallCount: () => readCallCountRef.current,
      getLastReadPath: () => lastReadPathRef.current,
      probeRenderedImage: () => {
        const img = document.querySelector<HTMLImageElement>('.pm-image-block-img')
        const pending = Boolean(document.querySelector('.pm-image-card-preview--pending'))
        const loadFailed = Boolean(document.querySelector('.pm-image-broken-placeholder-title'))
        const src = img?.getAttribute('src') ?? ''
        return {
          src,
          isBlobUrl: src.startsWith('blob:'),
          loadFailed,
          pending,
        }
      },
    }

    return () => {
      delete window.__LUNA_TEST_WORKSPACE_MEDIA_DECRYPT__
      delete window.__QA_ENCRYPTED_WORKSPACE_IMAGE__
      resetWorkspaceImageObjectUrlCacheForTests()
    }
  }, [])

  return (
    <div className="qa-encrypted-workspace-image-root">
      <p data-testid="qa-ready">Encrypted workspace image QA</p>
      <p data-testid="qa-status">ready</p>
      <div className="qa-document-editor-shell">
        <TiptapMarkdownEditor
          ref={editorRef}
          documentKey={`visual:${QA_NOTE}:0`}
          rootDir={QA_ROOT}
          activePath={QA_NOTE}
          markdown={`![image](${QA_IMAGE_SRC})`}
          sidebarListMode="outline"
          onMarkdownChange={() => {}}
          onActiveHeadingChange={() => {}}
          onStatus={() => {}}
          onPasteImage={async () => null}
          openReason={EditorOpenReason.ColdOpen}
        />
      </div>
    </div>
  )
}

export function QaEncryptedWorkspaceImagePlayground() {
  markAppSettingsHydratedForTests(DEFAULT_APP_SETTINGS)
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaEncryptedWorkspaceImageInner />
    </I18nProvider>
  )
}
