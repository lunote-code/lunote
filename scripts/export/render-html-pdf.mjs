/**
 * Use puppeteer-core to render local HTML to PDF (requires Chrome/Chromium to be installed on the machine).
 *
 * usage:
 *   PUPPETEER_EXECUTABLE_PATH="/path/to/chrome" node scripts/render-html-pdf.mjs input.html out.pdf
 *
 * macOS default attempts: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
 */
import path from 'node:path'
import { renderHtmlFileToPdf } from '../lib/render-html-pdf-core.mjs'

const [, , inHtml, outPdf] = process.argv
if (!inHtml || !outPdf) {
  console.error('Usage: node scripts/render-html-pdf.mjs <input.html> <output.pdf>')
  process.exit(1)
}

await renderHtmlFileToPdf(inHtml, outPdf)
console.log(`Wrote: ${path.resolve(outPdf)}`)
