declare module 'markdown-it-texmath' {
  import type MarkdownIt from 'markdown-it'
  import type katex from 'katex'

  type TexmathOptions = {
    engine: typeof katex
    delimiters?: 'dollars' | 'brackets' | 'gitlab' | 'julia' | 'kramdown' | 'doxygen' | 'beg_end'
    katexOptions?: import('katex').KatexOptions
  }

  function texmath(md: MarkdownIt, options?: TexmathOptions): void
  export default texmath
}

declare module 'markdown-it-emoji/lib/full.mjs' {
  import type MarkdownIt from 'markdown-it'

  function emoji(md: MarkdownIt): void
  export default emoji
}

declare module 'markdown-it-deflist' {
  import type MarkdownIt from 'markdown-it'

  function deflist(md: MarkdownIt): void
  export default deflist
}
