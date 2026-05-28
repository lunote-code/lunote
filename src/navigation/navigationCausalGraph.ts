import type { NavigationEvent } from './navigationEventTypes'
import type { NavigationActualSideEffect } from './navigationEventValidator'

export type NavigationCausalNode = {
  eventId: string
  event: NavigationEvent
  expectedEffects: string[]
  actualEffects: string[]
  missingEffects: string[]
  unexpectedEffects: string[]
}

const nodes = new Map<string, NavigationCausalNode>()
const actualOwners = new Map<string, string>()

export function startNavigationCausalTrace(
  event: NavigationEvent,
  expectedEffects: string[],
): NavigationCausalNode {
  const node: NavigationCausalNode = {
    eventId: event.id,
    event,
    expectedEffects: [...expectedEffects],
    actualEffects: [],
    missingEffects: [...expectedEffects],
    unexpectedEffects: [],
  }
  nodes.set(event.id, node)

  console.log('[NAV CAUSAL] event start', {
    eventId: event.id,
    type: event.type,
    source: event.source,
    path: event.path,
    docKey: event.docKey,
  })
  console.log('[NAV CAUSAL] expected effects', {
    eventId: event.id,
    expectedEffects: node.expectedEffects,
  })

  return node
}

export function recordNavigationCausalEffect(
  eventId: string | null,
  actual: NavigationActualSideEffect,
): NavigationCausalNode | null {
  if (!eventId) {
    console.log('[NAV CAUSAL] actual effects', {
      eventId: null,
      actualEffect: actual.kind,
      orphan: true,
    })
    return null
  }

  const node = nodes.get(eventId)
  if (!node) {
    console.log('[NAV CAUSAL] actual effects', {
      eventId,
      actualEffect: actual.kind,
      orphan: true,
    })
    return null
  }

  const priorOwner = actualOwners.get(actual.id)
  if (priorOwner && priorOwner !== eventId) {
    node.unexpectedEffects.push(actual.kind)
  } else {
    actualOwners.set(actual.id, eventId)
  }

  node.actualEffects.push(actual.kind)
  node.missingEffects = node.expectedEffects.filter((kind) => !node.actualEffects.includes(kind))
  node.unexpectedEffects = [
    ...new Set([
      ...node.unexpectedEffects,
      ...node.actualEffects.filter((kind) => !node.expectedEffects.includes(kind)),
    ]),
  ]

  console.log('[NAV CAUSAL] actual effects', {
    eventId,
    actualEffects: node.actualEffects,
  })
  console.log('[NAV CAUSAL] missing effects', {
    eventId,
    missingEffects: node.missingEffects,
  })
  if (node.missingEffects.length === 0) {
    console.log('[NAV CAUSAL] completed trace', {
      eventId,
      node,
    })
  }

  return node
}

export function getNavigationCausalNode(eventId: string): NavigationCausalNode | null {
  return nodes.get(eventId) ?? null
}

export function getNavigationCausalGraph(): NavigationCausalNode[] {
  return [...nodes.values()]
}

export function resetNavigationCausalGraph(): void {
  nodes.clear()
  actualOwners.clear()
}
