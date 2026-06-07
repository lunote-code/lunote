export function modKey(): 'Meta' | 'Control' {
  return process.platform === 'darwin' ? 'Meta' : 'Control'
}
