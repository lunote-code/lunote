import { plainTextFromClipboardData } from './webviewPasteBridge'

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

export function runBlockSourceTextareaPasteHarnessTests(): void {
  assertEqual(
    plainTextFromClipboardData({
      getData(type: string) {
        if (type === 'text/plain') return ''
        if (type === 'text/html') return '<p>from html</p>'
        return ''
      },
    } as DataTransfer),
    'from html',
    'plainTextFromClipboardData html fallback',
  )

  assertEqual(
    plainTextFromClipboardData({
      getData(type: string) {
        if (type === 'text/plain') return 'https://example.com/a.jpg'
        return ''
      },
    } as DataTransfer),
    'https://example.com/a.jpg',
    'remote url from plain',
  )
}
