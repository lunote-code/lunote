import {
  extractWorkspaceRelativeImagePaths,
  prefetchWorkspaceImagesFromMarkdown,
  acquireWorkspaceImageObjectUrl,
  base64ToBlob,
  guessWorkspaceMediaMime,
  isWorkspaceMediaDecryptEnabled,
  releaseWorkspaceImageObjectUrl,
  resetWorkspaceImageObjectUrlCacheForTests,
  resolveWorkspaceMediaFilePath,
  setReadWorkspaceFileBase64OverrideForTests,
} from './workspaceMediaBlob'

type Case = {
  readonly name: string
  readonly run: () => void | Promise<void>
}

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const ROOT = '/vault'
const NOTE = '/vault/notes/day.md'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`)
  }
}

const CASES: readonly Case[] = [
  {
    name: 'resolveWorkspaceMediaFilePath resolves note-relative asset paths',
    run: () => {
      assertEqual(
        resolveWorkspaceMediaFilePath(ROOT, NOTE, './note.assets/paste-1.png'),
        '/vault/notes/note.assets/paste-1.png',
        'relative asset path',
      )
    },
  },
  {
    name: 'resolveWorkspaceMediaFilePath ignores external http sources',
    run: () => {
      assertEqual(
        resolveWorkspaceMediaFilePath(ROOT, NOTE, 'https://example.com/a.png'),
        null,
        'external url',
      )
    },
  },
  {
    name: 'resolveWorkspaceMediaFilePath ignores paths outside workspace',
    run: () => {
      assertEqual(
        resolveWorkspaceMediaFilePath(ROOT, NOTE, '/etc/passwd'),
        null,
        'outside workspace',
      )
    },
  },
  {
    name: 'base64ToBlob produces image/png blob',
    run: () => {
      const blob = base64ToBlob(TINY_PNG_B64, guessWorkspaceMediaMime('test.png'))
      assertEqual(blob.type, 'image/png', 'blob mime')
      assert(blob.size > 0, 'blob must not be empty')
    },
  },
  {
    name: 'extractWorkspaceRelativeImagePaths collects note-relative image refs',
    run: () => {
      const paths = extractWorkspaceRelativeImagePaths(
        '# Title\n\n![a](./note.assets/a.png)\n![b](note.assets/b.jpg "title")\n![c](https://x.test/y.png)\n',
      )
      assertEqual(paths.length, 2, 'path count')
      assert(paths.includes('./note.assets/a.png'), 'relative path a')
      assert(paths.includes('note.assets/b.jpg'), 'relative path b')
    },
  },
  {
    name: 'prefetchWorkspaceImagesFromMarkdown starts decrypt for markdown images',
    run: async () => {
      const previous = globalThis.window
      ;(globalThis as { window?: Window }).window = { __LUNA_TEST_WORKSPACE_MEDIA_DECRYPT__: true } as Window
      let reads = 0
      setReadWorkspaceFileBase64OverrideForTests(async () => {
        reads += 1
        return TINY_PNG_B64
      })
      try {
        prefetchWorkspaceImagesFromMarkdown(
          ROOT,
          NOTE,
          '![img](./note.assets/prefetch.png)\n',
        )
        await new Promise((resolve) => setTimeout(resolve, 0))
        assertEqual(reads, 1, 'prefetch read count')
        releaseWorkspaceImageObjectUrl(ROOT, '/vault/notes/note.assets/prefetch.png')
      } finally {
        if (previous) {
          globalThis.window = previous
        } else {
          delete (globalThis as { window?: Window }).window
        }
        resetWorkspaceImageObjectUrlCacheForTests()
      }
    },
  },
  {
    name: 'acquireWorkspaceImageObjectUrl returns blob URL when decrypt reader succeeds',
    run: async () => {
      const previous = globalThis.window
      ;(globalThis as { window?: Window }).window = { __LUNA_TEST_WORKSPACE_MEDIA_DECRYPT__: true } as Window
      setReadWorkspaceFileBase64OverrideForTests(async () => TINY_PNG_B64)
      try {
        assert(isWorkspaceMediaDecryptEnabled(), 'decrypt must be enabled in QA test mode')
        const url = await acquireWorkspaceImageObjectUrl(ROOT, '/vault/notes/note.assets/encrypted-test.png')
        assert(url != null && url.startsWith('blob:'), 'must return blob URL')
        releaseWorkspaceImageObjectUrl(ROOT, '/vault/notes/note.assets/encrypted-test.png')
      } finally {
        if (previous) {
          globalThis.window = previous
        } else {
          delete (globalThis as { window?: Window }).window
        }
        resetWorkspaceImageObjectUrlCacheForTests()
      }
    },
  },
  {
    name: 'acquireWorkspaceImageObjectUrl reuses cached blob URL for same path',
    run: async () => {
      const previous = globalThis.window
      ;(globalThis as { window?: Window }).window = { __LUNA_TEST_WORKSPACE_MEDIA_DECRYPT__: true } as Window
      let reads = 0
      setReadWorkspaceFileBase64OverrideForTests(async () => {
        reads += 1
        return TINY_PNG_B64
      })
      const path = '/vault/notes/note.assets/cached.png'
      try {
        const first = await acquireWorkspaceImageObjectUrl(ROOT, path)
        const second = await acquireWorkspaceImageObjectUrl(ROOT, path)
        assertEqual(first, second, 'cached blob URL')
        assertEqual(reads, 1, 'read count')
        releaseWorkspaceImageObjectUrl(ROOT, path)
        releaseWorkspaceImageObjectUrl(ROOT, path)
      } finally {
        if (previous) {
          globalThis.window = previous
        } else {
          delete (globalThis as { window?: Window }).window
        }
        resetWorkspaceImageObjectUrlCacheForTests()
      }
    },
  },
  {
    name: 'acquireWorkspaceImageObjectUrl returns null when decrypt reader fails',
    run: async () => {
      const previous = globalThis.window
      ;(globalThis as { window?: Window }).window = { __LUNA_TEST_WORKSPACE_MEDIA_DECRYPT__: true } as Window
      setReadWorkspaceFileBase64OverrideForTests(async () => {
        throw new Error('WORKSPACE_LOCKED')
      })
      try {
        const url = await acquireWorkspaceImageObjectUrl(ROOT, '/vault/notes/note.assets/missing.png')
        assertEqual(url, null, 'blob url')
      } finally {
        if (previous) {
          globalThis.window = previous
        } else {
          delete (globalThis as { window?: Window }).window
        }
        resetWorkspaceImageObjectUrlCacheForTests()
      }
    },
  },
]

export async function assertWorkspaceMediaBlobSuite(): Promise<{ passed: number; failed: number }> {
  resetWorkspaceImageObjectUrlCacheForTests()
  let passed = 0
  let failed = 0
  for (const testCase of CASES) {
    try {
      await testCase.run()
      passed += 1
      console.log(`ok  ${testCase.name}`)
    } catch (error) {
      failed += 1
      console.error(`fail ${testCase.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  resetWorkspaceImageObjectUrlCacheForTests()
  return { passed, failed }
}
