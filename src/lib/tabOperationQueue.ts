let tabMutationChain: Promise<unknown> = Promise.resolve()
let tabMutationDepth = 0

/** Serialize fire-and-forget tab close / bulk-close operations so rapid clicks queue instead of racing. */
export function enqueueTabMutationOperation(task: () => Promise<void>): void {
  tabMutationChain = tabMutationChain
    .then(async () => {
      tabMutationDepth += 1
      try {
        await task()
      } finally {
        tabMutationDepth -= 1
      }
    })
    .catch(() => undefined)
}

export function isTabMutationOperationInFlight(): boolean {
  return tabMutationDepth > 0
}

export function getTabMutationQueueDepthForTests(): number {
  return tabMutationDepth
}

export async function awaitTabMutationQueue(): Promise<void> {
  await tabMutationChain
}

/** @deprecated Use awaitTabMutationQueue in production code. */
export async function awaitTabMutationQueueForTests(): Promise<void> {
  await awaitTabMutationQueue()
}

export function resetTabMutationQueueForTests(): void {
  tabMutationChain = Promise.resolve()
  tabMutationDepth = 0
}
