import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const JSON_PATH = path.join(__dirname, '..', 'export', 'chrome-executable-candidates.json')

export function loadChromeCandidatesFile() {
  return JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'))
}

export function listCandidateTemplates() {
  const file = loadChromeCandidatesFile()
  return {
    darwin: file.darwin,
    win32: file.win32,
    linux: file.linux,
    linuxRelativeHome: file.linuxRelativeHome ?? [],
    linuxWhichBinaries: file.linuxWhichBinaries ?? [],
  }
}

export function expandWinPath(template) {
  const pf = process.env.ProgramFiles || 'C:\\Program Files'
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  return template.replaceAll('{ProgramFiles(x86)}', pf86).replaceAll('{ProgramFiles}', pf)
}

export function chromeExecutableCandidatesForPlatform(platform = process.platform) {
  const file = loadChromeCandidatesFile()
  if (platform === 'darwin') {
    return [...file.darwin]
  }
  if (platform === 'win32') {
    return file.win32.map(expandWinPath)
  }
  const home = os.homedir()
  const candidates = [...file.linux]
  for (const rel of file.linuxRelativeHome ?? []) {
    candidates.push(path.join(home, rel))
  }
  return candidates
}

export function defaultChromeExecutable() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH?.trim()) {
    return process.env.PUPPETEER_EXECUTABLE_PATH.trim()
  }
  if (process.env.CHROME_PATH?.trim()) {
    return process.env.CHROME_PATH.trim()
  }
  for (const candidate of chromeExecutableCandidatesForPlatform()) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate
    }
  }
  if (process.platform === 'linux') {
    for (const name of loadChromeCandidatesFile().linuxWhichBinaries ?? []) {
      try {
        const resolved = spawnSync('which', [name], { encoding: 'utf8' }).stdout?.trim()
        if (resolved && fs.existsSync(resolved)) {
          return resolved
        }
      } catch {
        // ignore missing `which`
      }
    }
    return 'google-chrome-stable'
  }
  if (process.platform === 'win32') {
    return expandWinPath('{ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe')
  }
  return chromeExecutableCandidatesForPlatform()[0] ?? ''
}
