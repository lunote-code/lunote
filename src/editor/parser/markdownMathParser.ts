/**
 * The mathematical formula goes **markdown-it-texmath** (`markdown-it` token) → `prosemirror-markdown` ParseSpec:
 * - `math_inline` / `math_inline_double` → `inlineMath`
 * - `math_block` / `math_block_eqno` → `blockMath`
 *
 * For configuration, see `markdownIt.use(texmath, { delimiters: 'dollars', … })` in the root directory `markdownDocument.ts`.
 * WYSIWYG rendering is done by `extensions/MathNode.ts` (KaTeX `renderToString` + React NodeView).
 */
export {}
