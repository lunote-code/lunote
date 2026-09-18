import {
  computeSidebarHeaderVisibleViews,
  sidebarHeaderSlotWidth,
  splitSidebarHeaderViews,
} from './sidebarHeaderToolbarLayout'

type Case = {
  readonly name: string
  readonly run: () => void
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  const same =
    Array.isArray(actual) && Array.isArray(expected)
      ? actual.length === expected.length && actual.every((value, index) => value === expected[index])
      : actual === expected
  if (!same) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`)
  }
}

const VIEW_IDS = ['files-list', 'files-tree', 'outline', 'calendar'] as const

const CASES: readonly Case[] = [
  {
    name: 'sidebarHeaderSlotWidth counts button gaps',
    run: () => {
      assertEqual(sidebarHeaderSlotWidth(0), 0, 'zero slots')
      assertEqual(sidebarHeaderSlotWidth(1), 28, 'one slot')
      assertEqual(sidebarHeaderSlotWidth(2), 60, 'two slots')
      assertEqual(sidebarHeaderSlotWidth(4), 124, 'four slots')
    },
  },
  {
    name: 'computeSidebarHeaderVisibleViews fits four views at 240px',
    run: () => {
      const result = computeSidebarHeaderVisibleViews(240, 4, 2)
      assertEqual(result.maxVisible, 4, 'maxVisible')
      assertEqual(result.needsOverflow, false, 'needsOverflow')
    },
  },
  {
    name: 'computeSidebarHeaderVisibleViews keeps one visible view with overflow at 150px',
    run: () => {
      const result = computeSidebarHeaderVisibleViews(150, 4, 2)
      assertEqual(result.maxVisible, 1, 'maxVisible')
      assertEqual(result.needsOverflow, true, 'needsOverflow')
    },
  },
  {
    name: 'computeSidebarHeaderVisibleViews collapses to overflow menu before wrapping to second row',
    run: () => {
      const widths = [150, 180, 200, 220, 240]
      for (const width of widths) {
        const result = computeSidebarHeaderVisibleViews(width, 4, 2)
        assert(result.maxVisible >= 1, `width ${width} must keep at least one visible view`)
        if (result.needsOverflow) {
          assert(result.maxVisible < 4, `width ${width} must hide at least one view behind overflow`)
        }
      }
    },
  },
  {
    name: 'splitSidebarHeaderViews keeps active view visible when overflow is required',
    run: () => {
      const active = 'calendar'
      const split = splitSidebarHeaderViews(VIEW_IDS, active, 1)
      assertEqual(split.visible, ['calendar'], 'visible views')
      assertEqual(split.overflow.length, 3, 'overflow count')
      assert(!split.overflow.includes(active), 'active view must not move to overflow')
    },
  },
  {
    name: 'splitSidebarHeaderViews exposes all views when width allows',
    run: () => {
      const split = splitSidebarHeaderViews(VIEW_IDS, 'files-tree', 4)
      assertEqual(split.visible, [...VIEW_IDS], 'visible views')
      assertEqual(split.overflow.length, 0, 'overflow count')
    },
  },
]

export async function assertSidebarHeaderToolbarLayoutSuite(): Promise<{ passed: number; failed: number }> {
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
