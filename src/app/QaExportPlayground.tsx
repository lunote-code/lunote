import { useCallback, useEffect, useRef, useState } from 'react'

import { I18nProvider } from '../i18n'
import { getEnMessagesSnapshot, getLocaleMessagesSnapshot, getLocaleRawSnapshot } from '../i18n/localeRegistry'
import { buildPdfExportHtml } from '../export/pdfExportHtml'
import { resolveCurrentExportSettings } from '../export/exportPreset'
import { bundledFullExportStyles } from '../export/exportBundledStyles'
import { createExportThemeSnapshot } from '../export/exportThemeSnapshot'
import { buildRasterExportDocumentHtml, buildRasterExportStyles } from '../export/rasterExportFrame'
import { markdownToHtmlFragment } from '../export/markdownPipeline'
import {
  markdownToDocxBase64,
  markdownToPlainHtmlFragment,
  markdownToStyledHtmlFragment,
  resolveExportDocumentClasses,
  wrapStandaloneHtml,
} from '../markdownExport'
import { markdownToPngBase64 } from '../export/renderedDocumentExport'
import { joinExportDocumentClasses } from '../export/exportDocumentClasses'
import {
  analyzeDocxBase64,
  analyzePngBase64,
  samplePngPixels,
  type DocxAnalysis,
  type PngAnalysis,
} from './qaExportBinaryAnalysis'
import { markAppSettingsHydratedForTests } from '../settings/appSettingsStore'
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsTypes'
import { normalizeExportPageBreakMode, normalizeExportPresetId, normalizeExportTocMode } from '../export/exportPreset'

type ExportHtmlFormat = 'styled' | 'plain' | 'pdf'

declare global {
  interface Window {
    __QA_EXPORT__?: {
      buildHtml: (format: ExportHtmlFormat, markdown: string, dark?: boolean) => Promise<string>
      buildWordBase64: (markdown: string, dark?: boolean) => Promise<string>
      buildPngBase64: (markdown: string, dark?: boolean) => Promise<string>
      buildRasterHtml: (markdown: string, dark?: boolean) => Promise<string>
      analyzeDocx: (base64: string) => Promise<DocxAnalysis>
      analyzePng: (base64: string) => PngAnalysis
      samplePng: (base64: string) => Promise<{
        hasVisibleContent: boolean
        hasLightBackground: boolean
        hasDarkBackground: boolean
      }>
      mountPreview: (html: string) => void
      countInPreview: (selector: string) => number
      previewComputedStyle: (selector: string, prop: string) => string
      analyzeHtml: (html: string) => {
        hasStyleBlock: boolean
        styleBytes: number
        cssMarkers: Record<string, boolean>
        bodyCounts: Record<string, number>
        themeAttr: string | null
        rootClasses: string
      }
      hasConsoleErrors: () => boolean
      setExportSettings: (settings: {
        preset?: string
        tocMode?: string
        pageBreakMode?: string
      }) => void
    }
  }
}

const QA_BOOTSTRAP = {
  mergedMessages: getLocaleMessagesSnapshot('en'),
  enMessages: getEnMessagesSnapshot(),
  rawLocale: getLocaleRawSnapshot('en'),
  languageSetting: 'en' as const,
  effectiveLocale: 'en' as const,
}

const QA_APP_SETTINGS = { ...DEFAULT_APP_SETTINGS, language: 'en' as const }

function countInHtmlFragment(html: string, selector: string): number {
  const template = document.createElement('template')
  template.innerHTML = html
  return template.content.querySelectorAll(selector).length
}

function parseExportDocument(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

function extractBodyInnerHtml(doc: Document): string {
  const main = doc.querySelector('main')
  if (main) return main.innerHTML
  const article = doc.querySelector('article')
  return article?.innerHTML ?? doc.body.innerHTML
}

function extractStyleBlock(doc: Document): string {
  return doc.querySelector('style')?.textContent ?? ''
}

function QaExportInner() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState('booting')
  const consoleErrorsRef = useRef<string[]>([])

  const buildHtml = useCallback(async (format: ExportHtmlFormat, markdown: string, dark = false): Promise<string> => {
    const documentClasses = resolveExportDocumentClasses(markdown)
    if (format === 'pdf') {
      return buildPdfExportHtml(markdown, { title: 'Export QA', dark, localeId: 'en' })
    }
    const body =
      format === 'plain'
        ? await markdownToPlainHtmlFragment(markdown)
        : await markdownToStyledHtmlFragment(markdown, { dark })
    return wrapStandaloneHtml(body, {
      title: 'Export QA',
      styled: format === 'styled',
      dark,
      localeId: 'en',
      documentClasses,
    })
  }, [])

  const buildRasterHtml = useCallback(async (markdown: string, dark = false): Promise<string> => {
    const exportSettings = resolveCurrentExportSettings()
    const exportWidth = exportSettings.preset.contentWidthPx
    const snapshot = createExportThemeSnapshot({ dark, localeId: 'en' })
    const documentClassName = joinExportDocumentClasses(resolveExportDocumentClasses(markdown))
    const articleHtml = await markdownToHtmlFragment(markdown, {
      dark,
      localeId: 'en',
      tocMode: exportSettings.tocMode,
    })
    return buildRasterExportDocumentHtml({
      articleHtml,
      styles: buildRasterExportStyles(bundledFullExportStyles(snapshot)),
      exportSettings,
      exportWidth,
      dark,
      documentClassName,
      title: 'Export QA',
    })
  }, [])

  const buildWordBase64 = useCallback(async (markdown: string, dark = false): Promise<string> => {
    return markdownToDocxBase64(markdown, { dark, sourcePath: 'qa/export.md', rootDir: '/qa-vault' })
  }, [])

  const buildPngBase64 = useCallback(async (markdown: string, dark = false): Promise<string> => {
    return markdownToPngBase64(markdown, {
      title: 'Export QA',
      dark,
      localeId: 'en',
      sourcePath: 'qa/export.md',
      rootDir: '/qa-vault',
    })
  }, [])

  const mountPreview = useCallback((html: string) => {
    const iframe = iframeRef.current
    if (!iframe) return
    iframe.srcdoc = html
  }, [])

  const countInPreview = useCallback((selector: string): number => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return 0
    return doc.querySelectorAll(selector).length
  }, [])

  const previewComputedStyle = useCallback((selector: string, prop: string): string => {
    const doc = iframeRef.current?.contentDocument
    const el = doc?.querySelector(selector)
    if (!el) return ''
    return getComputedStyle(el).getPropertyValue(prop)
  }, [])

  const analyzeHtml = useCallback((html: string) => {
    const doc = parseExportDocument(html)
    const styleText = extractStyleBlock(doc)
    const bodyHtml = extractBodyInnerHtml(doc)
    const bodyEl = doc.body
    const cssMarkers = {
      markdownBody: styleText.includes('.markdown-body') || bodyEl.className.includes('markdown-export-root'),
      hljs: styleText.includes('.hljs'),
      katex: styleText.includes('.katex'),
      mdCallout: styleText.includes('.md-callout'),
      githubMarkdown: styleText.includes('--color-fg-default') || styleText.includes('github-markdown'),
    }
    const bodyCounts = {
      h1: countInHtmlFragment(bodyHtml, 'h1'),
      strong: countInHtmlFragment(bodyHtml, 'strong'),
      code: countInHtmlFragment(bodyHtml, 'code'),
      mdCallout: countInHtmlFragment(bodyHtml, '.md-callout'),
      table: countInHtmlFragment(bodyHtml, 'table'),
      hljsBlock: countInHtmlFragment(bodyHtml, 'pre code.hljs, code.hljs'),
      katex: countInHtmlFragment(bodyHtml, '.katex'),
    }
    return {
      hasStyleBlock: styleText.length > 0,
      styleBytes: styleText.length,
      cssMarkers,
      bodyCounts,
      themeAttr: bodyEl.getAttribute('data-theme'),
      rootClasses: bodyEl.className,
    }
  }, [])

  const setExportSettings = useCallback((settings: { preset?: string; tocMode?: string; pageBreakMode?: string }) => {
    const baseAppearance = (QA_APP_SETTINGS.appearance ?? DEFAULT_APP_SETTINGS.appearance)!
    markAppSettingsHydratedForTests({
      ...QA_APP_SETTINGS,
      appearance: {
        ...baseAppearance,
        export: {
          ...baseAppearance.export,
          preset: normalizeExportPresetId(settings.preset),
          tocMode: normalizeExportTocMode(settings.tocMode),
          pageBreakMode: normalizeExportPageBreakMode(settings.pageBreakMode),
        },
      },
    })
  }, [])

  useEffect(() => {
    markAppSettingsHydratedForTests(QA_APP_SETTINGS)
  }, [])

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      consoleErrorsRef.current.push(event.message)
    }
    window.addEventListener('error', onError)
    return () => window.removeEventListener('error', onError)
  }, [])

  useEffect(() => {
    window.__QA_EXPORT__ = {
      buildHtml,
      buildWordBase64,
      buildPngBase64,
      buildRasterHtml,
      analyzeDocx: analyzeDocxBase64,
      analyzePng: analyzePngBase64,
      samplePng: samplePngPixels,
      mountPreview,
      countInPreview,
      previewComputedStyle,
      analyzeHtml,
      hasConsoleErrors: () => consoleErrorsRef.current.length > 0,
      setExportSettings,
    }
    setStatus('ready')
    return () => {
      delete window.__QA_EXPORT__
    }
  }, [analyzeHtml, buildHtml, buildPngBase64, buildRasterHtml, buildWordBase64, countInPreview, mountPreview, previewComputedStyle, setExportSettings])

  return (
    <div style={{ padding: 24, background: '#0f1115', minHeight: '100vh' }}>
      <h1 data-testid="qa-ready">Export QA</h1>
      <p data-testid="qa-status">{status}</p>
      <iframe
        ref={iframeRef}
        data-testid="qa-export-preview"
        title="Export preview"
        style={{ width: '100%', maxWidth: 980, height: 720, border: '1px solid #334155', background: '#fff' }}
      />
    </div>
  )
}

export function QaExportPlayground() {
  return (
    <I18nProvider bootstrap={QA_BOOTSTRAP}>
      <QaExportInner />
    </I18nProvider>
  )
}
