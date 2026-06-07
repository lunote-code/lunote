/**
 * Puppeteer vector PDF rendering core (aligned with desktop Chrome headless printing).
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'
import { defaultChromeExecutable } from './chrome-executable-candidates.mjs'

export { defaultChromeExecutable } from './chrome-executable-candidates.mjs'

export const DEFAULT_PDF_MARGIN_MM = { top: '18mm', bottom: '18mm', left: '14mm', right: '14mm' }

export async function renderHtmlFileToPdf(inHtml, outPdf, options = {}) {
  const abs = path.resolve(inHtml)
  await fs.access(abs)
  const executablePath = options.executablePath ?? defaultChromeExecutable()
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    await page.goto(pathToFileURL(abs).href, {
      waitUntil: 'networkidle0',
      timeout: options.timeoutMs ?? 120_000,
    })
    await page.pdf({
      path: path.resolve(outPdf),
      format: 'A4',
      printBackground: true,
      margin: DEFAULT_PDF_MARGIN_MM,
    })
  } finally {
    await browser.close()
  }
}

export async function renderHtmlStringToPdf(html, outPdf, options = {}) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lunote-pdf-'))
  const htmlPath = path.join(tmpDir, 'export.html')
  try {
    await fs.writeFile(htmlPath, html, 'utf8')
    await renderHtmlFileToPdf(htmlPath, outPdf, options)
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
}
