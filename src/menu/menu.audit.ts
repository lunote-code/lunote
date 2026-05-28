/**
 * @deprecated Auditing has been upgraded to `menu.guard.ts` enforcement; this module only remains compatible with re-export.
 */
export type { MenuGuardViolation as MenuAuditEntry, MenuGuardInput as MenuAuditInput } from './menu.guard'
export {
  assertMenuGuard,
  isMenuGuardArmed as isMenuAuditEnabled,
  logMenuGuardReport as logMenuAuditReport,
  runMenuGuard as runMenuAudit,
  setMenuGuardArmed as setMenuAuditEnabled,
} from './menu.guard'
