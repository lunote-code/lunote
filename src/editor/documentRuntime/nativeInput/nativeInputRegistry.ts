export type NativeInputType =
  | 'textarea'
  | 'input'
  | 'monaco'
  | 'codemirror'
  | 'contenteditable'
  | 'mathlive'
  | 'sandpack'
  | 'custom'

export type NativeInputRegistration = {
  id: string
  type: NativeInputType
  dom: HTMLElement
  blockId?: string | null
}

const byId = new Map<string, NativeInputRegistration>()
const domToId = new WeakMap<HTMLElement, string>()

let idCounter = 0

function nextId(): string {
  return `native-input:${++idCounter}`
}

export function registerNativeInput(
  entry: {
    id?: string
    type: NativeInputType
    dom: HTMLElement
    blockId?: string | null
  },
): string {
  const id = entry.id ?? nextId()
  const reg: NativeInputRegistration = {
    id,
    type: entry.type,
    dom: entry.dom,
    blockId: entry.blockId ?? null,
  }
  byId.set(id, reg)
  domToId.set(entry.dom, id)
  entry.dom.dataset.nativeInputId = id
  return id
}

export function unregisterNativeInput(id: string): void {
  const reg = byId.get(id)
  if (reg) {
    delete reg.dom.dataset.nativeInputId
    domToId.delete(reg.dom)
    byId.delete(id)
  }
}

export function getNativeInputRegistration(id: string): NativeInputRegistration | undefined {
  return byId.get(id)
}

export function getNativeInputByDom(dom: HTMLElement): NativeInputRegistration | undefined {
  const id = domToId.get(dom) ?? dom.dataset.nativeInputId
  if (id) return byId.get(id)
  const root = dom.closest<HTMLElement>('[data-native-input-id]')
  if (root?.dataset.nativeInputId) return byId.get(root.dataset.nativeInputId)
  for (const reg of byId.values()) {
    if (reg.dom === dom || reg.dom.contains(dom)) return reg
  }
  return undefined
}

export function findNativeInputForTarget(target: EventTarget | null): NativeInputRegistration | undefined {
  if (!(target instanceof HTMLElement)) return undefined
  return getNativeInputByDom(target)
}

export function listNativeInputRegistrations(): NativeInputRegistration[] {
  return [...byId.values()]
}

export function clearNativeInputRegistry(): void {
  for (const reg of byId.values()) {
    delete reg.dom.dataset.nativeInputId
  }
  byId.clear()
}
