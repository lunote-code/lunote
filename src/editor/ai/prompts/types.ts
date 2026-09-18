export type TaskMode =
  | 'chat'
  | 'write'
  | 'rewrite'
  | 'summarize'
  | 'translate'
  | 'search'
  | 'knowledge'

export const DEFAULT_TASK_MODE: TaskMode = 'chat'

export function resolveTaskMode(taskMode?: TaskMode | null): TaskMode {
  return taskMode ?? DEFAULT_TASK_MODE
}
