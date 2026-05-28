export type DocumentTickKind = 'render' | 'layout' | 'selection' | 'history' | 'viewport'

const ticks: Record<DocumentTickKind, number> = {
  render: 0,
  layout: 0,
  selection: 0,
  history: 0,
  viewport: 0,
}

let epoch = 0

export function bumpDocumentTick(kind: DocumentTickKind): number {
  epoch += 1
  ticks[kind] += 1
  return ticks[kind]
}

export function getDocumentTick(kind: DocumentTickKind): number {
  return ticks[kind]
}

export function getDocumentEpoch(): number {
  return epoch
}

export function resetDocumentClock(): void {
  epoch = 0
  for (const k of Object.keys(ticks) as DocumentTickKind[]) {
    ticks[k] = 0
  }
}
