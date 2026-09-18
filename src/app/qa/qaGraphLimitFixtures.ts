/** Star topology: hub links to many spokes to exceed NOTE_GRAPH_MAX_NODES in QA. */
export const GRAPH_LIMIT_HUB_STEM = 'graph-hub'
export const GRAPH_LIMIT_SPOKE_COUNT = 150

export function buildGraphLimitFixtures(): Record<string, string> {
  const links = Array.from({ length: GRAPH_LIMIT_SPOKE_COUNT }, (_, index) => {
    const id = String(index + 1).padStart(3, '0')
    return `[[graph-spoke-${id}]]`
  }).join('\n')

  const fixtures: Record<string, string> = {
    [`${GRAPH_LIMIT_HUB_STEM}.md`]: `# Graph Hub\n\n${links}\n`,
  }

  for (let i = 1; i <= GRAPH_LIMIT_SPOKE_COUNT; i += 1) {
    const id = String(i).padStart(3, '0')
    fixtures[`graph-spoke-${id}.md`] = `# Spoke ${id}\n\nleaf\n`
  }

  return fixtures
}
