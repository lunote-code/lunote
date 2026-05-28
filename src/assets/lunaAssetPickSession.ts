/** Prevent the slash command from triggering file selection or importing repeatedly*/
let pickInFlight: Promise<unknown> | null = null

export async function withLunaAssetPickInFlight<T>(fn: () => Promise<T>): Promise<T | null> {
  if (pickInFlight) {
    try {
      return (await pickInFlight) as T
    } catch {
      return null
    }
  }
  const run = fn()
  pickInFlight = run.finally(() => {
    if (pickInFlight === run) pickInFlight = null
  })
  try {
    return await run
  } catch {
    return null
  }
}
