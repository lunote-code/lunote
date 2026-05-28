import { rewriteRelativeMediaSources, buildMediaSourceResolveOptions } from '../../export/mediaSources'

export function rewriteExportHtmlMediaSources(
  html: string,
  sourcePath: string,
  rootDir: string | null,
): string {
  const template = document.createElement('template')
  template.innerHTML = html
  rewriteRelativeMediaSources(
    template.content,
    sourcePath,
    buildMediaSourceResolveOptions(rootDir, { preferFileUrl: true }),
  )
  return template.innerHTML
}
