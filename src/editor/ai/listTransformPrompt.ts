export type ListTransformTarget = 'auto' | 'bullet' | 'ordered' | 'task'

function buildListTransformOutputRules(scope: 'selection' | 'block'): string {
  return scope === 'block'
    ? 'Action output format: Output paste-ready Markdown for a single list block only—no preamble, postscript, or wrapper text.'
    : 'Action output format: Output paste-ready Markdown only—the final list block from the first line through the last line, with no preamble or postscript.'
}

function buildListTransformCommonRules(): string[] {
  return [
    'Detect peer items from paragraphs, blank lines, line breaks, semicolons, or other clear inline separators when they represent a list. Treat semicolons as list boundaries only when they clearly separate peer items, not when they are part of a single sentence.',
    'If the source is already a list, normalize and clean it instead of rewriting its structure unnecessarily.',
    'Preserve existing nesting and indentation whenever the hierarchy is already implied by the source.',
    'Keep the original meaning, language, and relative ordering. Do not add commentary outside the final list.',
  ]
}

function buildTargetListRule(target: Exclude<ListTransformTarget, 'auto'>): string {
  switch (target) {
    case 'bullet':
      return 'Output an unordered Markdown bullet list using "- " markers only. Do not use ordered or task-list markers.'
    case 'ordered':
      return 'Output an ordered Markdown list using "1. " style markers only. Do not use bullet or task-list markers.'
    case 'task':
      return 'Output a Markdown task list using "- [ ] " markers only (unchecked items). Do not use bullet or ordered markers.'
    default:
      return ''
  }
}

export function buildListTransformSystemHint(
  scope: 'selection' | 'block' = 'selection',
  target: ListTransformTarget = 'auto',
): string {
  const firstLine = buildListTransformOutputRules(scope)
  const common = buildListTransformCommonRules()

  if (target !== 'auto') {
    return [firstLine, 'Convert the provided text into a Markdown list.', buildTargetListRule(target), ...common].join(
      '\n',
    )
  }

  return [
    firstLine,
    'Convert the provided text into the most appropriate Markdown list automatically.',
    ...common.slice(0, 1),
    'Prefer an ordered list when the source is sequential, ranked, step-by-step, or already uses markers such as 1. 2. 3., 1)、1、, first/second/third, or 第一/第二/第三.',
    'Prefer a task list when the source reads like actionable items or status items, especially with markers such as TODO, todo, 待做, 待办, 完成, 未完成, [ ], [x], or checkbox-like wording.',
    'Use an unordered list for all other collections of parallel points.',
    ...common.slice(1),
  ].join('\n')
}
