/** Broadcast of workspace changes between multiple Webview windows from the same origin (supplements OS file monitoring delay)*/

export type WorkspaceBroadcastMessage =
  | { type: 'document-saved'; root: string; path: string }
  | { type: 'workspace-touched'; root: string }

const CHANNEL_NAME = 'luna-workspace-v1'

let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME)
  return channel
}

export function postWorkspaceBroadcast(message: WorkspaceBroadcastMessage): void {
  getChannel()?.postMessage(message)
}

export function subscribeWorkspaceBroadcast(
  listener: (message: WorkspaceBroadcastMessage) => void,
): () => void {
  const ch = getChannel()
  if (!ch) return () => undefined
  const handler = (event: MessageEvent<WorkspaceBroadcastMessage>) => {
    const data = event.data
    if (!data || typeof data !== 'object' || !('type' in data)) return
    listener(data)
  }
  ch.addEventListener('message', handler)
  return () => ch.removeEventListener('message', handler)
}
