import {
  isLikelyImageFileReference,
  shouldPasteClipboardText,
} from './webviewPasteBridge'

type Case = {
  readonly name: string
  readonly run: () => void
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`)
  }
}

const VECTEEZY_URL =
  'https://static.vecteezy.com/system/resources/previews/082/639/328/large_2x/artist-paints-with-fingers-on-a-large-canvas-in-an-art-studio-showing-tactile-color-texture-and-abstract-technique-showing-creative-process-studio-practice-and-contemporary-artwork-photo.jpg'

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'remote https image URLs are not local file references',
    run: () => {
      assertEqual(isLikelyImageFileReference(VECTEEZY_URL), false, 'vecteezy url')
      assertEqual(isLikelyImageFileReference('https://example.com/a.png'), false, 'https png')
    },
  },
  {
    name: 'bare filenames and file URLs remain image file references',
    run: () => {
      assertEqual(isLikelyImageFileReference('photo.jpg'), true, 'bare filename')
      assertEqual(isLikelyImageFileReference('file:///tmp/paste.png'), true, 'file url')
    },
  },
  {
    name: 'shouldPasteClipboardText allows remote image URLs in rich paste',
    run: () => {
      assertEqual(shouldPasteClipboardText(VECTEEZY_URL, false), true, 'vecteezy rich paste')
      assertEqual(shouldPasteClipboardText('photo.jpg', false), false, 'finder filename rich paste')
      assertEqual(shouldPasteClipboardText('photo.jpg', true), true, 'plain-only always pastes text')
    },
  },
])

export async function assertWebviewPasteBridgeSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0

  for (const testCase of CASES) {
    try {
      testCase.run()
      passed += 1
    } catch (error) {
      failed += 1
      console.error(`[webviewPasteBridge] ${testCase.name}:`, error)
    }
  }

  return { passed, failed }
}
