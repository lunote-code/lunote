import { decideModeToggleCommandAction } from './modeToggleCommandSemantics'

type Case = {
  readonly name: string
  readonly run: () => void
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`)
  }
}

const CASES: readonly Case[] = Object.freeze([
  {
    name: 'Cmd+/ from source always returns to visual',
    run: () => {
      assertEqual(
        decideModeToggleCommandAction({
          mainPaneMode: 'source',
          activeBlockType: 'mermaidBlock',
          hasActiveLocalSourceIsland: true,
        }),
        'switch_source_to_visual',
        'source pane',
      )
    },
  },
  {
    name: 'Cmd+/ in mermaid/math/html enters document source, not a local island',
    run: () => {
      for (const blockType of ['mermaidBlock', 'blockMath', 'rawBlock', 'codeBlock'] as const) {
        assertEqual(
          decideModeToggleCommandAction({
            mainPaneMode: 'visual',
            activeBlockType: blockType,
            hasActiveLocalSourceIsland: false,
          }),
          'switch_visual_to_source',
          `${blockType} visual idle`,
        )
      }
    },
  },
  {
    name: 'Cmd+/ with a local island already open still enters document source',
    run: () => {
      assertEqual(
        decideModeToggleCommandAction({
          mainPaneMode: 'visual',
          activeBlockType: 'mermaidBlock',
          hasActiveLocalSourceIsland: true,
        }),
        'switch_visual_to_source',
        'island-active mermaid',
      )
    },
  },
])

export async function assertModeToggleCommandSemanticsSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0
  for (const testCase of CASES) {
    try {
      testCase.run()
      passed += 1
      console.log(`ok  ${testCase.name}`)
    } catch (error) {
      failed += 1
      console.error(`fail ${testCase.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { passed, failed }
}
