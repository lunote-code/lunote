import { getOutlineParseSchema } from './markdownOutlineFromMarkdown'
import { parseMarkdownToDoc } from './markdownDocument'
import { compileMarkdown } from './compiler/markdownCompiler'

function countTopLevelBlocks(doc: import('@tiptap/pm/model').Node, typeName: string): number {
  let count = 0
  for (let i = 0; i < doc.childCount; i += 1) {
    if (doc.child(i).type.name === typeName) count += 1
  }
  return count
}

function countNodes(doc: import('@tiptap/pm/model').Node, typeName: string): number {
  let count = 0
  doc.descendants((node) => {
    if (node.type.name === typeName) count += 1
  })
  return count
}

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n/g, '\n').trim()
}

function assertRoundTrip(markdown: string, schema: import('@tiptap/pm/model').Schema, label: string): void {
  const parsed = parseMarkdownToDoc(markdown, schema)
  const serialized = compileMarkdown(parsed, schema)
  const reparsed = parseMarkdownToDoc(serialized, schema)
  const reserialized = compileMarkdown(reparsed, schema)

  if (normalizeMarkdown(serialized) !== normalizeMarkdown(reserialized)) {
    throw new Error(`${label}: markdown round-trip diverged after second pass`)
  }
}

export function runCoreMarkdownFeatureRoundtripHarness(): void {
  const schema = getOutlineParseSchema()

  const bulletMarkdown = [
    '- alpha item',
    '- beta item',
    '  - nested gamma',
    '  - nested delta',
    '- epsilon item',
    '',
  ].join('\n')

  const bulletDoc = parseMarkdownToDoc(bulletMarkdown, schema)
  if (countTopLevelBlocks(bulletDoc, 'bulletList') !== 1) {
    throw new Error('bullet list parse should produce one top-level bulletList')
  }
  if (countNodes(bulletDoc, 'listItem') !== 5) {
    throw new Error(`bullet list parse should preserve five list items (got ${countNodes(bulletDoc, 'listItem')})`)
  }
  const bulletSerialized = compileMarkdown(bulletDoc, schema)
  if (!bulletSerialized.includes('- alpha item') || !bulletSerialized.includes('nested gamma')) {
    throw new Error('bullet list serialize must preserve item text')
  }
  assertRoundTrip(bulletMarkdown, schema, 'bullet list')

  const orderedMarkdown = [
    '1. first step',
    '2. second step',
    '3. third step',
    '',
  ].join('\n')

  const orderedDoc = parseMarkdownToDoc(orderedMarkdown, schema)
  if (countTopLevelBlocks(orderedDoc, 'orderedList') !== 1) {
    throw new Error('ordered list parse should produce one top-level orderedList')
  }
  if (countNodes(orderedDoc, 'listItem') !== 3) {
    throw new Error(`ordered list parse should preserve three list items (got ${countNodes(orderedDoc, 'listItem')})`)
  }
  const orderedSerialized = compileMarkdown(orderedDoc, schema)
  if (!/^\s*1\.\s+first step/m.test(orderedSerialized)) {
    throw new Error('ordered list serialize must preserve numeric markers')
  }
  assertRoundTrip(orderedMarkdown, schema, 'ordered list')

  const tableMarkdown = [
    '| Column A | Column B |',
    '| --- | --- |',
    '| cell 1 | cell 2 |',
    '| cell 3 | cell 4 |',
    '',
  ].join('\n')

  const tableDoc = parseMarkdownToDoc(tableMarkdown, schema)
  if (countTopLevelBlocks(tableDoc, 'table') !== 1) {
    throw new Error('table parse should produce one top-level table')
  }
  if (countNodes(tableDoc, 'tableRow') !== 3) {
    throw new Error(`table parse should preserve three rows (got ${countNodes(tableDoc, 'tableRow')})`)
  }
  const tableSerialized = compileMarkdown(tableDoc, schema)
  if (!tableSerialized.includes('Column A') || !tableSerialized.includes('cell 4')) {
    throw new Error('table serialize must preserve header and cell text')
  }
  assertRoundTrip(tableMarkdown, schema, 'table')

  const mermaidMarkdown = ['```mermaid', 'graph TD', '  Start-->Finish', '```', ''].join('\n')

  const mermaidDoc = parseMarkdownToDoc(mermaidMarkdown, schema)
  if (countTopLevelBlocks(mermaidDoc, 'mermaidBlock') !== 1) {
    throw new Error('mermaid fence parse should produce one mermaidBlock')
  }
  if (countTopLevelBlocks(mermaidDoc, 'codeBlock') !== 0) {
    throw new Error('mermaid fence parse must not leave a generic codeBlock')
  }
  const mermaidSerialized = compileMarkdown(mermaidDoc, schema)
  if (!mermaidSerialized.includes('```mermaid') || !mermaidSerialized.includes('Start-->Finish')) {
    throw new Error('mermaid serialize must preserve fenced mermaid source')
  }
  assertRoundTrip(mermaidMarkdown, schema, 'mermaid')

  const combinedMarkdown = [
    '# Core features',
    '',
    '- unordered alpha',
    '- unordered beta',
    '',
    '1. ordered one',
    '2. ordered two',
    '',
    '| Feature | Status |',
    '| --- | --- |',
    '| lists | ok |',
    '| tables | ok |',
    '',
    '```mermaid',
    'flowchart LR',
    '  Lists --> Tables',
    '  Tables --> Mermaid',
    '```',
    '',
  ].join('\n')

  const combinedDoc = parseMarkdownToDoc(combinedMarkdown, schema)
  if (countTopLevelBlocks(combinedDoc, 'bulletList') !== 1) {
    throw new Error('combined doc should contain one bullet list')
  }
  if (countTopLevelBlocks(combinedDoc, 'orderedList') !== 1) {
    throw new Error('combined doc should contain one ordered list')
  }
  if (countTopLevelBlocks(combinedDoc, 'table') !== 1) {
    throw new Error('combined doc should contain one table')
  }
  if (countTopLevelBlocks(combinedDoc, 'mermaidBlock') !== 1) {
    throw new Error('combined doc should contain one mermaid block')
  }
  assertRoundTrip(combinedMarkdown, schema, 'combined core markdown features')

  const chineseProductMarkdown = [
    '# AI产品研发',
    '',
    '这是启动恢复后必须能看见的正文。',
    '',
  ].join('\n')
  const chineseDoc = parseMarkdownToDoc(chineseProductMarkdown, schema)
  if (!chineseDoc.textContent.includes('AI产品研发') || !chineseDoc.textContent.includes('必须能看见')) {
    throw new Error('TipTap schema must still parse Chinese product-note markdown into visible text')
  }
  assertRoundTrip(chineseProductMarkdown, schema, 'chinese product note')
}

if (import.meta.url.endsWith(process.argv[1] ?? '')) {
  runCoreMarkdownFeatureRoundtripHarness()
  console.log('ok core markdown feature roundtrip harness')
}
