import type { ModeSwitchPrepareResultKind } from './viewportModeAnchor'
import type { ModeToggleCommandActionKind } from './modeToggleCommandSemantics'

export type ModeSwitchRegressionExpectation = {
  readonly visualToSource: ModeSwitchPrepareResultKind
  readonly sourceToVisualStrict: ModeSwitchPrepareResultKind
  readonly sourceToVisualDegraded: ModeSwitchPrepareResultKind
}

export type ModeToggleRegressionExpectation = {
  readonly visualIdle: ModeToggleCommandActionKind
  readonly visualLocalActive?: Extract<ModeToggleCommandActionKind, 'close_local_source_island'>
}

export type ModeSwitchRegressionCase = {
  readonly id: string
  readonly description: string
  readonly markdown: string
  readonly expected: ModeSwitchRegressionExpectation
  readonly commandSlash: ModeToggleRegressionExpectation
}

/**
 * Minimal mode-switch regression corpus.
 * These samples mirror the structures that repeatedly broke strict freeze/projection:
 * heading prefixes, hard breaks, HTML/raw blocks, fences, nested lists, and blockquotes.
 */
export const MODE_SWITCH_REGRESSION_CASES: readonly ModeSwitchRegressionCase[] = Object.freeze([
  {
    id: 'heading-basic',
    description: '标题内容需要落在 heading body，而不是 `#` 前缀上',
    markdown: '# Markdown 测试用例大全（Markdown Test Suite）\n',
    expected: {
      visualToSource: 'strict_success',
      sourceToVisualStrict: 'strict_success',
      sourceToVisualDegraded: 'degraded_success',
    },
    commandSlash: {
      visualIdle: 'switch_visual_to_source',
    },
  },
  {
    id: 'paragraph-hard-break',
    description: '段落中的尾随反斜杠换行需要保持 semantic text 与 markdown body 对齐',
    markdown: '这是第三段文本，包含两个空格行尾换行\\\\\n这一行是换行后的内容。11\n',
    expected: {
      visualToSource: 'strict_success',
      sourceToVisualStrict: 'strict_success',
      sourceToVisualDegraded: 'degraded_success',
    },
    commandSlash: {
      visualIdle: 'switch_visual_to_source',
    },
  },
  {
    id: 'raw-html-comment',
    description: 'HTML comment / rawBlock 必须走原子映射，不参与普通 inline strict zip',
    markdown: '<!-- 111 -->\n',
    expected: {
      visualToSource: 'strict_success',
      sourceToVisualStrict: 'strict_success',
      sourceToVisualDegraded: 'degraded_success',
    },
    commandSlash: {
      visualIdle: 'open_local_source_island',
      visualLocalActive: 'close_local_source_island',
    },
  },
  {
    id: 'fenced-code',
    description: '代码块正文与 fence 头尾需要分开建模',
    markdown: '```ts\nfunction sum(a: number, b: number) {\n  return a + b\n}\n```\n',
    expected: {
      visualToSource: 'strict_success',
      sourceToVisualStrict: 'strict_success',
      sourceToVisualDegraded: 'degraded_success',
    },
    commandSlash: {
      visualIdle: 'suppress_in_code_block',
    },
  },
  {
    id: 'nested-bullet-list',
    description: '嵌套列表应按 leaf paragraph 行投影，而不是整个容器 flatten',
    markdown:
      '- 项目 A\n- 项目 B\n  - 子项目 B1\n  - 子项目 B2\n    - 深层子项目 B2.1\n- 另一种星号列表\n- 第二项\n',
    expected: {
      visualToSource: 'strict_success',
      sourceToVisualStrict: 'strict_success',
      sourceToVisualDegraded: 'degraded_success',
    },
    commandSlash: {
      visualIdle: 'switch_visual_to_source',
    },
  },
  {
    id: 'blockquote-lines',
    description: '引用块中的正文需要剥离 `>` 前缀后再进入语义空间',
    markdown: '> 第一行引用\n>\n> 第二行引用\n',
    expected: {
      visualToSource: 'strict_success',
      sourceToVisualStrict: 'strict_success',
      sourceToVisualDegraded: 'degraded_success',
    },
    commandSlash: {
      visualIdle: 'switch_visual_to_source',
    },
  },
  {
    id: 'block-math',
    description: '块级公式需要只映射公式正文，不把 `$$` 定界符混入语义空间',
    markdown: '$$\na^2+b^2=c^2\n$$\n',
    expected: {
      visualToSource: 'strict_success',
      sourceToVisualStrict: 'strict_success',
      sourceToVisualDegraded: 'degraded_success',
    },
    commandSlash: {
      visualIdle: 'open_local_source_island',
      visualLocalActive: 'close_local_source_island',
    },
  },
  {
    id: 'footnote-def',
    description: '脚注定义需要跳过 `[^label]: ` 前缀后再做 strict zip',
    markdown: '[^note]: 这是脚注定义\n',
    expected: {
      visualToSource: 'strict_success',
      sourceToVisualStrict: 'strict_success',
      sourceToVisualDegraded: 'degraded_success',
    },
    commandSlash: {
      visualIdle: 'switch_visual_to_source',
    },
  },
  {
    id: 'link-reference-def',
    description: '链接引用定义应作为原子 leaf row 对齐整行 Markdown',
    markdown: '[ref]: https://example.com \"Example\"\n',
    expected: {
      visualToSource: 'strict_success',
      sourceToVisualStrict: 'strict_success',
      sourceToVisualDegraded: 'degraded_success',
    },
    commandSlash: {
      visualIdle: 'switch_visual_to_source',
    },
  },
  {
    id: 'mermaid-fence',
    description: 'Mermaid block 应优先进入局部 source tab，第二次 Command+/ 应回到 preview',
    markdown: '```mermaid\ngraph TD\n  A-->B\n```\n',
    expected: {
      visualToSource: 'strict_success',
      sourceToVisualStrict: 'strict_success',
      sourceToVisualDegraded: 'degraded_success',
    },
    commandSlash: {
      visualIdle: 'open_local_source_island',
      visualLocalActive: 'close_local_source_island',
    },
  },
  {
    id: 'luna-raw-fence',
    description: 'luna-raw fence 必须映射到 rawBlock 正文，而不是退回 codeBlock',
    markdown: '```luna-raw\nsource: unknown\n<div>raw body</div>\n```\n',
    expected: {
      visualToSource: 'strict_success',
      sourceToVisualStrict: 'strict_success',
      sourceToVisualDegraded: 'degraded_success',
    },
    commandSlash: {
      visualIdle: 'open_local_source_island',
      visualLocalActive: 'close_local_source_island',
    },
  },
  {
    id: 'definition-list',
    description: '定义列表需要同时覆盖 definitionTerm 与 definitionDescription 内段落',
    markdown: '术语 A\n: 定义 A\n',
    expected: {
      visualToSource: 'strict_success',
      sourceToVisualStrict: 'strict_success',
      sourceToVisualDegraded: 'degraded_success',
    },
    commandSlash: {
      visualIdle: 'switch_visual_to_source',
    },
  },
  {
    id: 'toc-directive',
    description: '`[toc]` 应稳定映射到 tocDirective，而不是 paragraph',
    markdown: '[toc]\n',
    expected: {
      visualToSource: 'strict_success',
      sourceToVisualStrict: 'strict_success',
      sourceToVisualDegraded: 'degraded_success',
    },
    commandSlash: {
      visualIdle: 'switch_visual_to_source',
    },
  },
  {
    id: 'callout-block',
    description: 'callout 需要按内部 leaf paragraph 对齐，而不是退回 legacy 顶层块',
    markdown: '> [!NOTE] 提示内容\n> 第二行说明\n',
    expected: {
      visualToSource: 'strict_success',
      sourceToVisualStrict: 'strict_success',
      sourceToVisualDegraded: 'degraded_success',
    },
    commandSlash: {
      visualIdle: 'switch_visual_to_source',
    },
  },
  {
    id: 'trailing-blank-lines',
    description: '尾部连续空行不应再依赖 legacy 顶层段数对齐',
    markdown: '# 标题\n\n正文\n\n\n',
    expected: {
      visualToSource: 'strict_success',
      sourceToVisualStrict: 'strict_success',
      sourceToVisualDegraded: 'degraded_success',
    },
    commandSlash: {
      visualIdle: 'switch_visual_to_source',
    },
  },
])
