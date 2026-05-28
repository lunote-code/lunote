import type { FrozenStructuralIR } from './modeSwitchStructuralIR'

const IR_ROW_KEYS = new Set([
  'blockIndex',
  'rowKey',
  'blockPath',
  'blockType',
  'cmStart',
  'cmEnd',
  'pmStart',
  'pmEnd',
  'semanticExtent',
  'semanticSlices',
])
const IR_ROOT_KEYS = new Set(['canonicalFingerprint', 'blocks'])

/**
 * DEV: Freeze kernel contracts — fail with `console.error` (not warn).
 */
export function assertFrozenKernelContract(args: { frozenStructuralIR: FrozenStructuralIR }): void {
  if (!import.meta.env.DEV) return
  const ir = args.frozenStructuralIR
  let ok = true

  const rootKeys = Object.keys(ir)
  if (rootKeys.length !== IR_ROOT_KEYS.size || rootKeys.some((k) => !IR_ROOT_KEYS.has(k))) {
    ok = false
     
    console.error('[kernel-contract] FrozenStructuralIR root has illegal keys', rootKeys)
  }

  for (let i = 0; i < ir.blocks.length; i += 1) {
    const row = ir.blocks[i] as unknown as Record<string, unknown>
    const keys = Object.keys(row)
    if (keys.length !== IR_ROW_KEYS.size || keys.some((k) => !IR_ROW_KEYS.has(k))) {
      ok = false
       
      console.error('[kernel-contract] IR row has illegal keys', { index: i, keys })
      break
    }
  }

  if (!ok) {
     
    console.error('[kernel-contract] assertFrozenKernelContract FAILED')
  }
}
