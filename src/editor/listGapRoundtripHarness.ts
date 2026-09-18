import { getOutlineParseSchema } from './markdownOutlineFromMarkdown'
import { parseMarkdownToDoc } from './markdownDocument'
import { compileMarkdown } from './compiler/markdownCompiler'
import {
  findTopLevelListRestartSplitIndices,
  isListGapOnlyParagraph,
  LIST_GAP_MARK,
} from './listGapMarkdown'

function countTopLevelBlocks(doc: import('@tiptap/pm/model').Node, typeName: string): number {
  let count = 0
  for (let i = 0; i < doc.childCount; i += 1) {
    if (doc.child(i).type.name === typeName) count += 1
  }
  return count
}

function countEmptyParagraphsBetweenLists(doc: import('@tiptap/pm/model').Node): number {
  let firstListIndex = -1
  let secondListIndex = -1
  for (let i = 0; i < doc.childCount; i += 1) {
    const name = doc.child(i).type.name
    if (name === 'orderedList' || name === 'bulletList' || name === 'taskList') {
      if (firstListIndex < 0) firstListIndex = i
      else if (secondListIndex < 0) secondListIndex = i
    }
  }
  if (firstListIndex < 0 || secondListIndex < 0) return 0
  let blanks = 0
  for (let i = firstListIndex + 1; i < secondListIndex; i += 1) {
    const child = doc.child(i)
    if (child.type.name === 'paragraph' && child.content.size === 0) blanks += 1
    if (isListGapOnlyParagraph(child)) blanks += 1
  }
  return blanks
}

export function runListGapRoundtripHarness(): void {
  const schema = getOutlineParseSchema()
  const { orderedList, listItem, paragraph, bulletList } = schema.nodes

  const sourceDoc = schema.node('doc', null, [
    orderedList.create(null, [
      listItem.create(null, [paragraph.create(null, [schema.text('财务相关app')])]),
      listItem.create(null, [
        paragraph.create(null, [schema.text('Tarsi - Budget Tracker')]),
        bulletList.create(null, [
          listItem.create(null, [paragraph.create(null, [schema.text('离线优先')])]),
          listItem.create(null, [paragraph.create(null, [schema.text('AI 记账')])]),
        ]),
      ]),
    ]),
    paragraph.create(),
    paragraph.create(),
    paragraph.create(),
    orderedList.create(null, [
      listItem.create(null, [paragraph.create(null, [schema.text('阿斯顿')])]),
      listItem.create(null, [paragraph.create(null, [schema.text('阿斯顿的')])]),
    ]),
  ])

  if (countTopLevelBlocks(sourceDoc, 'orderedList') !== 2) {
    throw new Error('fixture should start with two ordered lists')
  }
  if (countEmptyParagraphsBetweenLists(sourceDoc) !== 3) {
    throw new Error('fixture should keep three blank lines between lists')
  }

  const markdown = compileMarkdown(sourceDoc, schema)
  if (!markdown.includes(LIST_GAP_MARK)) {
    throw new Error('serialized markdown should include list-gap marker')
  }

  const roundTripped = parseMarkdownToDoc(markdown, schema)
  if (countTopLevelBlocks(roundTripped, 'orderedList') !== 2) {
    throw new Error('round-trip should preserve two separate ordered lists')
  }
  const blankCount = countEmptyParagraphsBetweenLists(roundTripped)
  if (blankCount !== 3) {
    throw new Error(`round-trip should preserve blank lines between lists (${blankCount} !== 3)`)
  }

  const mergedMarkdown = [
    '1. 财务相关app',
    '2. Tarsi - Budget Tracker',
    '   - 离线优先',
    '   - AI 记账',
    '',
    '',
    '1. 阿斯顿',
    '2. 阿斯顿的',
    '',
  ].join('\n')

  const splitIndices = findTopLevelListRestartSplitIndices(mergedMarkdown)
  if (splitIndices.length !== 1 || splitIndices[0] !== 1) {
    throw new Error(`blank-line restart scan should split after first list block (${JSON.stringify(splitIndices)})`)
  }

  const recoveredFromMerged = parseMarkdownToDoc(mergedMarkdown, schema)
  if (countTopLevelBlocks(recoveredFromMerged, 'orderedList') !== 2) {
    throw new Error('parse should split merged markdown lists at blank-line restarts')
  }
  if (countEmptyParagraphsBetweenLists(recoveredFromMerged) !== 2) {
    throw new Error('parse should preserve blank lines between split lists')
  }

  for (let i = 0; i < recoveredFromMerged.childCount; i += 1) {
    if (isListGapOnlyParagraph(recoveredFromMerged.child(i))) {
      throw new Error('normalized doc should not keep invisible list-gap markers')
    }
  }
}

if (import.meta.url.endsWith(process.argv[1] ?? '')) {
  runListGapRoundtripHarness()
  console.log('ok list gap roundtrip harness')
}
