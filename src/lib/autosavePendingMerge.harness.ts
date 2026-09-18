type AutosaveRunnerState = {
  busy: boolean
  pending: boolean
  runs: number
}

/** Mirrors useAutosave busy/pending merge semantics for contract tests. */
export function createAutosaveRunner(runSave: () => Promise<boolean>): {
  state: AutosaveRunnerState
  tick: () => void
  drain: () => Promise<void>
} {
  const state: AutosaveRunnerState = { busy: false, pending: false, runs: 0 }

  const tick = (): void => {
    if (state.busy) {
      state.pending = true
      return
    }
    state.busy = true
    void runSave()
      .catch(() => undefined)
      .finally(() => {
        state.busy = false
        if (state.pending) {
          state.pending = false
          tick()
        }
      })
    state.runs += 1
  }

  const drain = async (): Promise<void> => {
    while (state.busy || state.pending) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      })
    }
  }

  return { state, tick, drain }
}

type Case = {
  name: string
  run: () => void | Promise<void>
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const cases: Case[] = [
  {
    name: 'overlapping ticks coalesce into a follow-up run',
    run: async () => {
      let saveCount = 0
      const runner = createAutosaveRunner(
        () =>
          new Promise<boolean>((resolve) => {
            saveCount += 1
            if (saveCount === 1) {
              setTimeout(() => resolve(true), 0)
              return
            }
            resolve(true)
          }),
      )
      runner.tick()
      runner.tick()
      assert(runner.state.pending, 'second tick while busy must set pending')
      await runner.drain()
      assert(saveCount === 2, `expected 2 saves, got ${saveCount}`)
    },
  },
]

export async function assertAutosavePendingMergeSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0
  for (const testCase of cases) {
    try {
      await testCase.run()
      passed += 1
    } catch (error) {
      failed += 1
      console.error(`fail ${testCase.name}:`, error)
    }
  }
  return { passed, failed }
}
