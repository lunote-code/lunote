import { registerCustomProtocol } from 'linkifyjs'

const LUNA_LINK_PROTOCOLS = ['mailto', 'luna-asset'] as const

let registered = false

/** Only register once globally to avoid visual editor remount / StrictMode triggering linkify repeated registration alarms*/
export function ensureLunaLinkifyProtocols(): void {
  if (registered) return
  registered = true
  for (const scheme of LUNA_LINK_PROTOCOLS) {
    try {
      registerCustomProtocol(scheme)
    } catch {
      /*Linkify may throw an error when initialized, the protocol is usually still available*/
    }
  }
}

ensureLunaLinkifyProtocols()
