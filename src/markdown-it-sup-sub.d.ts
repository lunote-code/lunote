declare module 'markdown-it-sup' {
  import type MarkdownIt from 'markdown-it'

  function markdownItSup(md: MarkdownIt): void
  export default markdownItSup
}

declare module 'markdown-it-sub' {
  import type MarkdownIt from 'markdown-it'

  function markdownItSub(md: MarkdownIt): void
  export default markdownItSub
}
