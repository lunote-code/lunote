let serialChain: Promise<unknown> = Promise.resolve()
/** When already within a serial task, nested kernel/save calls must be executed synchronously, otherwise a deadlock will occur.*/
let serialDepth = 0

/** Serialize disk save and Document Kernel commands to avoid OPEN/SAVE race conditions.*/
function enqueueSerial<T>(task: () => Promise<T>): Promise<T> {
  if (serialDepth > 0) {
    return task()
  }
  const run = serialChain.then(
    async () => {
      serialDepth += 1
      try {
        return await task()
      } finally {
        serialDepth -= 1
      }
    },
    async () => {
      serialDepth += 1
      try {
        return await task()
      } finally {
        serialDepth -= 1
      }
    },
  )
  serialChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

/** Serialize disk saving to avoid autosave / tab cutting / manual saving and concurrent writing of the same file.*/
export function enqueueSave<T>(task: () => Promise<T>): Promise<T> {
  return enqueueSerial(task)
}

/** Serialize Document Kernel commands to avoid OPEN/SAVE/CLOSE race conditions.*/
export function enqueueDocumentCommand<T>(task: () => Promise<T>): Promise<T> {
  return enqueueSerial(task)
}
