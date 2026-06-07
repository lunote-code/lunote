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
  /** When set, regression simulates detached YAML prepended to `markdown` (visual body). */
  readonly leadingFrontmatter?: Readonly<Record<string, unknown>>
  readonly expected: ModeSwitchRegressionExpectation
  readonly strictExpected?: ModeSwitchRegressionExpectation
  readonly commandSlash: ModeToggleRegressionExpectation
}

/**
 * Minimal mode-switch regression corpus.
 * These samples mirror the structures that repeatedly broke strict freeze/projection:
 * heading prefixes, hard breaks, HTML/raw blocks, fences, nested lists, and blockquotes.
 *
 * Each case runs 3 stages: visualToSource + sourceToVisualStrict (Cmd+/ round-trip, expect strict)
 * + sourceToVisualDegraded (cold path without snapshot, expect degraded). The ≈67%/33% stage
 * ratio in summaries is therefore structural — use roundTripStrictRate for product quality.
 */
export const MODE_SWITCH_REGRESSION_CASES: readonly ModeSwitchRegressionCase[] = Object.freeze([
  {
    id: 'heading-basic',
    description: 'Heading content should map to the heading body, not the `#` prefix',
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
    description: 'Trailing backslash hard breaks in paragraphs should keep semantic text aligned with the markdown body',
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
    description: 'HTML comments and rawBlock content must use atomic mapping instead of normal inline strict zip',
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
    id: 'raw-html-block-div',
    description: 'HTML block elements should freeze as rawBlock content without entering inline strict zip',
    markdown: '<div style="padding:10px;border:1px solid red;">\nHTML Block\n</div>\n',
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
    description: 'Code block bodies and fence delimiters should be modeled separately',
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
    description: 'Nested lists should project by leaf paragraph rows instead of flattening the whole container',
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
    description: 'Blockquote text should enter semantic space after stripping the `>` prefixes',
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
    description: 'Block math should map only the formula body without mixing `$$` delimiters into semantic space',
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
    id: 'inline-math-line',
    description: 'Inline `$...$` math in a paragraph must align PM inlineMath latex with markdown formula body',
    markdown: '$E = mc^2$\n',
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
    id: 'inline-math-in-prose',
    description: 'Inline math embedded in prose should zip with surrounding plain text',
    markdown: '行内：$E = mc^2$\n',
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
    id: 'footnote-def',
    description: 'Footnote definitions should skip the `[^label]: ` prefix before strict zip',
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
    id: 'footnote-def-empty-body',
    description: 'Empty footnote definitions must map to zero-width semantic body instead of a stray newline token',
    markdown: '[^longnote]: \n',
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
    id: 'leading-blank-before-footnotes',
    description: 'Leading blank lines before consecutive footnote definitions should not create extra PM-only empty paragraph rows',
    markdown: '\n\n\n\n\n\n\n[^1]: 简单脚注\n\n[^longnote]: \n\n```\n多行脚注\n第二行内容\n```\n\n---\n\n# 数学公式\n',
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
    id: 'mid-run-blank-before-footnotes',
    description: 'Blank paragraph runs in the middle of a document should not leave PM with more empty rows than markdown before footnotes',
    markdown:
      '# 脚注\n\n这里有一个脚注[^1]\n\n这里有第二个脚注[^longnote]\n\n\n\n\n\n[^1]: 简单脚注\n\n[^longnote]: \n\n```\n多行脚注\n第二行内容\n```\n\n---\n\n# 数学公式\n\n行内公式：\n\n$E = mc^2$\n\n块公式：\n\n$$\nE = mc^2\n$$\n',
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
    id: 'wiki-embed-inline',
    description: 'Obsidian-style wiki embeds should tokenize as plain semantic text instead of falling into markdown image parsing',
    markdown: '![[新笔记]]\n',
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
    id: 'wiki-embed-block-ref',
    description: 'Wiki embed block references must not gain a caret escape on serialize (⌘+/ strict freeze)',
    markdown: '![[Daily Note^block-id]]\n',
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
    id: 'wiki-embed-block-ref-legacy-escape',
    description: 'Legacy `\\^` block-ref escapes inside wiki embeds should normalize for strict mode switch',
    markdown: '![[Daily Note\\^block-id]]\n',
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
    description: 'Link reference definitions should align the full markdown line as an atomic leaf row',
    markdown: '[ref]: https://example.com "Example"\n',
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
    description: 'Mermaid blocks should open a local source tab first, and the second Command+/ should return to preview',
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
    description: 'A luna-raw fence must map to the rawBlock body instead of falling back to codeBlock',
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
    description: 'Definition lists should cover both definitionTerm and paragraphs inside definitionDescription',
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
    description: '`[toc]` should map stably to tocDirective instead of paragraph',
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
    id: 'horizontal-rule',
    description: 'Horizontal rules should behave as zero-payload structural rows during mode switch',
    markdown: '---\n',
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
    description: 'Callouts should align by internal leaf paragraphs instead of falling back to legacy top-level blocks',
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
    id: 'callout-hardbreak-line',
    description: 'Callout body lines containing only a trailing hard-break marker should preserve strict semantic newline alignment',
    markdown: '> [!NOTE]\n> \\\n> This is a note callout.\n',
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
    id: 'callout-hardbreak-batch',
    description: 'Multiple callouts using standalone hard-break lines should not double-count semantic newlines',
    markdown:
      '> [!NOTE]\n> \\\n> Note Callout\n\n> [!TIP]\n> \\\n> Tip Callout\n\n> [!WARNING]\n> \\\n> Warning Callout\n',
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
    id: 'callout-hardbreak-deep-run',
    description: 'Callouts with many consecutive blank quote lines should preserve line count without synthesizing hard-break escapes',
    markdown:
      '> [!NOTE]\n>\n>\n>\n>\n>\n>\n>\n>\n>\n> Note Callout\n\n> [!TIP]\n>\n>\n>\n>\n>\n>\n>\n>\n>\n> Tip Callout\n',
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
    id: 'obsidian-syntax-batch',
    description: 'Reported Obsidian-style syntax batch with callouts/wiki/embed/block refs should survive round-trip mode switching',
    markdown:
      '二级引用\n\n---\n\n# Callout\n\n> [!NOTE]\n>\n>\n>\n>\n>\n>\n>\n>\n>\n> Note Callout\n\n> [!TIP]\n>\n>\n>\n>\n>\n>\n>\n>\n>\n> Tip Callout\n\n> [!WARNING]\n>\n>\n>\n>\n>\n>\n>\n>\n>\n> Warning Callout\n\n> [!DANGER]\n>\n>\n>\n>\n>\n>\n>\n>\n>\n> Danger Callout\n\n> [!INFO]\n> Success Callout\n\n---\n\n# 链接\n\n## 外部链接\n\n[OpenAI](https://openai.com)\n\n<https://openai.com>\n\n## Wiki Link\n\n[[首页]]\n\n[[首页|显示名称]]\n\n[[文件夹/笔记]]\n\n---\n\n# 嵌入\n\n![[首页]]\n\n![[图片.png]]\n\n![[文档.pdf]]\n\n---\n\n# 块引用\n\n这是一个块。 ^test-block\n\n引用该块：\n\n[[首页]]\n',
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
    description: 'Trailing blank lines should no longer depend on legacy top-level block count alignment',
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
  {
    id: 'trailing-blank-after-bullet-list',
    description: 'When a bullet list is the last top-level block, trailing blank lines should survive reconstruction',
    markdown: '- 第一项\n- 第二项\n- 第三项\n\n\n',
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
    id: 'trailing-blank-after-ordered-list',
    description: 'When an ordered list is the last top-level block, trailing blank lines should be preserved stably',
    markdown: '1. 第一项\n2. 第二项\n3. 第三项\n\n\n',
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
    id: 'trailing-blank-after-task-list',
    description: 'When a task list ends the document, trailing blank lines should not be swallowed by the view layer',
    markdown: '- [ ] 待办一\n- [x] 已完成二\n- [ ] 待办三\n\n\n',
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
    id: 'trailing-blank-after-table',
    description: 'When a table is the last top-level block, trailing blank lines should still map to visible blank segments',
    markdown: '| 列 A | 列 B |\n| --- | --- |\n| 单元格 1 | 单元格 2 |\n\n\n',
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
    id: 'trailing-blank-after-blockquote',
    description: 'When a blockquote ends the document, trailing blank lines must not disappear at container block boundaries',
    markdown: '> 第一行引用\n> 第二行引用\n\n\n',
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
    id: 'trailing-blank-after-image-paragraph',
    description: 'When an image paragraph ends the document, separator blank lines should not enter strict semantic tokenization',
    markdown: '![image](./assets/paste-demo.png)\n\n\n',
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
    id: 'trailing-blank-after-fenced-code',
    description: 'When a fenced code block ends the document, trailing blank lines after the fence should remain stable',
    markdown: '```ts\nconst answer = 42\nconsole.log(answer)\n```\n\n\n',
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
    id: 'trailing-blank-after-mermaid',
    description: 'When a Mermaid block ends the document, trailing blank lines should also survive local source/preview toggles',
    markdown: '```mermaid\ngraph TD\n  A-->B\n  B-->C\n```\n\n\n',
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
    id: 'react-nodeview-composite',
    description:
      'Composite doc with TOC + Mermaid + callout + trailing blanks (mirrors real notes that mount React NodeViews on ⌘+/ mode switch)',
    markdown:
      '# 思维流程\n\n[toc]\n\n## 流程图\n\n```mermaid\ngraph TD\n  A[开始]-->B[结束]\n```\n\n## 备注\n\n> [!NOTE] 数据信息需要统一\n\n\n\n\n',
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
    id: 'superscript-line',
    description: 'Superscript ^...^ in a paragraph (markdown-it-sup) must align PM/MD semantic tokens on mode switch',
    markdown: '# 高版本JDK测试\n\n[[若依相关问题-4.0.8]]\n\n\n^可以参考的文章：^\n\n- <https://example.com>\n',
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
    id: 'footnote-ref-inline',
    description: 'Inline footnote refs should align atom PM nodes with raw `[^label]` markdown text',
    markdown: '这是一个脚注测试[^1]\n',
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
    id: 'empty-and-newline-only',
    description:
      'Empty or newline-only source buffers must not fail leaf IR row count on source→visual (spurious empty PM heading)',
    markdown: '\n\n',
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
    id: 'nested-asterisk-emphasis',
    description:
      'Ambiguous `***a*a**` must align PM bold span with markdown-it emphasis (not hand-split plain+em tokens)',
    markdown: '***a*a**\n',
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
    id: 'highlight-inline',
    description: 'Typora-style `==highlight==` should tokenize only the highlighted inner text',
    markdown: '==重点==\n',
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
    id: 'emoji-shortcode-inline',
    description: 'Emoji shortcode `:smile:` should align the emoji node with serialized shortcode text',
    markdown: ':smile:\n',
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
    id: 'raw-inline-html',
    description: 'Inline HTML wrappers such as `<u>` and styled `<span>` should preserve semantic inner text',
    markdown: '<u>underline</u> 和 <span style="color:red">red</span>\n',
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
    id: 'inline-link-code-subscript',
    description: 'Inline link/code/subscript combinations should zip against markdown payload bodies',
    markdown: '[链接](https://example.com) `code` H~2~O\n',
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
    id: 'mixed-inline-composite',
    description: 'A single paragraph mixing highlight/link/code/math/emoji/footnote/html should still strict-zip correctly',
    markdown:
      '组合：==重点== [链接](https://example.com) `code` $E = mc^2$ :smile: [^1] <u>underline</u> H~2~O\n',
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
    id: 'task-in-progress-bullet',
    description: 'Plain bullet `- in progress` inside nested blockquotes must not lose a prefix during strict zip',
    markdown: '> note\n>\n> > [!tip] Nested tip\n\n- in progress\n',
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
    id: 'obsidian-task-status-markers',
    description: 'Obsidian-style escaped task status markers `\\[-\\]` / `\\[>\\]` should stay aligned on mode switch',
    markdown: '- in progress\n\n- \\[-\\] cancelled\n\n- \\[>\\] forwarded\n\n- \\[<\\] scheduling\n',
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
    id: 'mixed-block-composite',
    description:
      'Real-world notes combining headings/callouts/tables/wiki embeds/footnotes/math/raw html should keep mode switch stable',
    markdown:
      '# 组合测试\n\n> [!NOTE] ==重点== [链接](https://example.com)\n> 第二行含 $E = mc^2$ 与 :smile:\n\n![[Daily Note^block-id]]\n\n<div style="padding:4px">raw block</div>\n\n| Name | Value |\n| --- | --- |\n| code | `x` |\n| sub | H~2~O |\n\n[^mix]: 脚注内容\n',
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
    id: 'composite-callout-wiki-html',
    description:
      'Callout + wiki embed + raw html block should preserve leaf-row count alignment',
    markdown:
      '# 组合测试\n\n> [!NOTE] ==重点== [链接](https://example.com)\n> 第二行含 $E = mc^2$ 与 :smile:\n\n![[Daily Note^block-id]]\n\n<div style="padding:4px">raw block</div>\n',
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
    id: 'composite-html-table-footnote',
    description: 'Raw html block + table + footnote definition should not create leaf-row count mismatches',
    markdown:
      '<div style="padding:4px">raw block</div>\n\n| Name | Value |\n| --- | --- |\n| code | `x` |\n| sub | H~2~O |\n\n[^mix]: 脚注内容\n',
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
    id: 'mixed-nested-quote-list',
    description: 'Nested quote/list/task mixtures with callouts and inline syntax should not shift semantic prefixes',
    markdown:
      '> [!TIP] 外层提示\n> > 二级引用里有 [链接](https://example.com) 和 ==高亮==\n>\n> - 列表项一\n> - [ ] task child\n>\n> 普通行含 <u>underline</u> 与 [^n]\n\n[^n]: nested footnote\n',
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
    id: 'leading-yaml-frontmatter',
    description:
      'Leading YAML block maps body selection through source↔visual round-trip (detached frontmatter coordinate scheme)',
    markdown: '# Hello\n\nParagraph under frontmatter.\n',
    leadingFrontmatter: { tags: ['regression', 'mode-switch'] },
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

export const MODE_SWITCH_PRODUCTION_REGRESSION_CASES: readonly ModeSwitchRegressionCase[] =
  MODE_SWITCH_REGRESSION_CASES

export const MODE_SWITCH_STRICT_CONTRACT_REGRESSION_CASES: readonly ModeSwitchRegressionCase[] = Object.freeze(
  MODE_SWITCH_REGRESSION_CASES.map((regressionCase) =>
    Object.freeze({
      ...regressionCase,
      expected: regressionCase.strictExpected ?? regressionCase.expected,
    }),
  ),
)
