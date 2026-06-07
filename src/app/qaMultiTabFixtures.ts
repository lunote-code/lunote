export const QA_MULTI_TAB_ROOT = '/qa-vault'

export const QA_MULTI_TAB_DOC_A = `${QA_MULTI_TAB_ROOT}/doc-a.md`
export const QA_MULTI_TAB_DOC_B = `${QA_MULTI_TAB_ROOT}/doc-b.md`
export const QA_MULTI_TAB_DOC_C = `${QA_MULTI_TAB_ROOT}/doc-c.md`

export const QA_MULTI_TAB_PATHS = [
  QA_MULTI_TAB_DOC_A,
  QA_MULTI_TAB_DOC_B,
  QA_MULTI_TAB_DOC_C,
] as const

export const QA_MULTI_TAB_MARKERS = {
  [QA_MULTI_TAB_DOC_A]: 'MARKER-A-ORIGINAL',
  [QA_MULTI_TAB_DOC_B]: 'MARKER-B-ORIGINAL',
  [QA_MULTI_TAB_DOC_C]: 'MARKER-C-ORIGINAL',
} as const

const QA_MULTI_TAB_DOC_A_CODE = [
  '```cpp',
  'void heapify(vector<int>& arr, int n, int i) {',
  '  // code block save probe',
  '}',
  '```',
].join('\n')

export const QA_MULTI_TAB_FIXTURES: Record<string, string> = {
  [QA_MULTI_TAB_DOC_A]: `# Doc A\n\n${QA_MULTI_TAB_DOC_A_CODE}\n\n${QA_MULTI_TAB_MARKERS[QA_MULTI_TAB_DOC_A]}\n`,
  [QA_MULTI_TAB_DOC_B]: `---\ntitle: Doc B\n---\n\n# Doc B\n\n${QA_MULTI_TAB_MARKERS[QA_MULTI_TAB_DOC_B]}\n`,
  [QA_MULTI_TAB_DOC_C]: `# Doc C\n\n${QA_MULTI_TAB_MARKERS[QA_MULTI_TAB_DOC_C]}\n`,
}

export function qaMultiTabMarkerForPath(path: string): string | undefined {
  return Object.entries(QA_MULTI_TAB_MARKERS).find(([key]) => key === path)?.[1]
}
