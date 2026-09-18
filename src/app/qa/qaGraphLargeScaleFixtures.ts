/** Star hub with 1000+ spokes — stresses link index + graph render cap (NOTE_GRAPH_MAX_*). */
export const GRAPH_LARGE_SCALE_HUB_STEM = 'graph-mega-hub'
export const GRAPH_LARGE_SCALE_SPOKE_COUNT = 1050

export function buildGraphLargeScaleFixtures(): Record<string, string> {
  const links = Array.from({ length: GRAPH_LARGE_SCALE_SPOKE_COUNT }, (_, index) => {
    const id = String(index + 1).padStart(4, '0')
    return `[[graph-mega-spoke-${id}]]`
  }).join('\n')

  const fixtures: Record<string, string> = {
    [`${GRAPH_LARGE_SCALE_HUB_STEM}.md`]: `# Mega Graph Hub\n\n${links}\n`,
  }

  for (let i = 1; i <= GRAPH_LARGE_SCALE_SPOKE_COUNT; i += 1) {
    const id = String(i).padStart(4, '0')
    fixtures[`graph-mega-spoke-${id}.md`] = `# Mega Spoke ${id}\n\nleaf\n`
  }

  return fixtures
}
