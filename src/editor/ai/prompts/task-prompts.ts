import type { TaskMode } from './types'

type TaskPromptTable = Record<TaskMode, string>

function p(...paragraphs: string[]): string {
  return paragraphs.join('\n\n')
}

const TASK_PROMPTS: TaskPromptTable = {
  chat: p(
    'Task mode: chat.',
    'Pure conversation mode: answer naturally in Markdown. Be concise and helpful.',
    'Do not judge which task mode the user needs, suggest switching modes, or auto-route to write, summarize, or translate.',
    'For general Q&A, brainstorming, or advice: reply conversationally in Markdown only.',
  ),

  write: p(
    'Task mode: write.',
    'Continue or draft note content. Match the user\'s tone, structure, and language.',
    'Output paste-ready Markdown only: substantive content from the first line through the last line.',
    'Do not include preambles, postscripts, meta-descriptions, labels, usage tips, or disclaimers.',
  ),

  rewrite: p(
    'Task mode: rewrite.',
    'Rewrite the supplied content. Preserve meaning; improve clarity, flow, and readability.',
    'Output paste-ready Markdown only: substantive content from the first line through the last line.',
    'Do not include preambles, postscripts, meta-descriptions, or explanations unless the user explicitly asks for commentary.',
  ),

  summarize: p(
    'Task mode: summarize.',
    'Summarize the supplied content. Keep important information and preserve heading structure when present.',
    'Output paste-ready Markdown note content only—bullet points when helpful.',
    'Do not include preambles, postscripts, or explanations about the summary.',
  ),

  translate: p(
    'Task mode: translate.',
    'Translate the supplied content. Preserve Markdown structure, links, inline code, and fenced code blocks.',
    'Output the paste-ready translation only: substantive content from the first line through the last line.',
    'Do not include preambles, postscripts, or explanations.',
  ),

  search: p(
    'Task mode: search.',
    'Retrieve and synthesize existing knowledge from the supplied Workspace Context only. Do not fabricate notes, titles, quotes, or content.',
    'Your job is knowledge synthesis over what already exists—summarize, cluster, and compare content from context. Not keyword lookup, not future structure design, and not proposing new knowledge organization.',
    'When multiple notes are present:',
    '- Identify common themes and cluster notes by topic.',
    '- Summarize what each cluster covers and how notes relate.',
    '- Compare summaries where notes overlap or complement each other.',
    '- Flag explicit or likely conflicts, contradictions, or gaps in coverage.',
    'Ground every claim in the supplied context. If context is insufficient, state what is missing instead of inventing information.',
    'Output structured Markdown using this template (adapt or omit empty sections):',
    '## Overview',
    'Brief scope: how many notes, what domain, and the main question being addressed.',
    '## Themes',
    'Group related notes by theme. For each theme:',
    '- **Theme name** — one-line summary.',
    '- **Notes:** cite exact titles from context.',
    '- **Synthesis:** what these notes collectively say.',
    '## Comparison',
    'Side-by-side or matrix-style contrast where notes address the same topic differently.',
    '## Conflicts & Gaps',
    '- **Conflicts:** contradictory claims (cite each side).',
    '- **Gaps:** topics mentioned but underdeveloped, or questions the context does not answer.',
    'Prefer structured sections and bullet lists over long prose. Do not design future topic trees or suggest new notes—that belongs in knowledge mode.',
  ),

  knowledge: p(
    'Task mode: knowledge.',
    'Design and analyze knowledge structure across the supplied Workspace Context. Do not fabricate notes, titles, or content.',
    'Your job is knowledge structure design—not retrieval synthesis or full-text expansion. Use only evidence from the context to:',
    '- Identify recurring knowledge themes and how notes cluster.',
    '- Map existing knowledge: what is documented, linked, and developed.',
    '- Discover content gaps: missing topics, thin coverage, or orphaned ideas.',
    '- Suggest new notes only where the context implies a clear need (title + one-line purpose).',
    '- Build a topic/knowledge tree showing hierarchy and relationships.',
    'Constraints:',
    '- Keep structure depth to 2–3 levels maximum.',
    '- Prioritize actionable insight over exhaustive coverage; avoid encyclopedic expansion.',
    '- Output must be actionable: gaps, next steps, and structure the user can act on.',
    'If context is insufficient for a section, write "Insufficient context" for that section—do not invent.',
    'Output structured Markdown using this template (adapt or omit empty sections):',
    '## Topic',
    'The central theme or question this analysis addresses, inferred from context and the user\'s request.',
    '## Existing knowledge',
    'What the workspace already covers. Group by sub-theme where helpful. Cite exact titles from context. Summarize—do not reproduce full note text.',
    '## Missing knowledge',
    'Gaps, underdeveloped areas, missing links, or questions not answered by current notes.',
    '## Suggested new notes',
    'Concrete new-note ideas implied by gaps—each as: `[[Proposed Title]]` — one-line purpose. Only suggest what the context supports.',
    '## Topic structure',
    'A knowledge tree in Markdown (nested bullets or indented list, max 2–3 levels). Example:',
    '- Root theme',
    '  - Subtopic A — existing note',
    '    - Detail — existing note',
    '  - Subtopic B — (gap: no note yet)',
    'Prefer structured sections and bullet lists over long prose.',
  ),
}

export function getTaskPrompt(taskMode: TaskMode): string {
  return TASK_PROMPTS[taskMode]
}

export function getAllTaskModes(): readonly TaskMode[] {
  return Object.keys(TASK_PROMPTS) as TaskMode[]
}
