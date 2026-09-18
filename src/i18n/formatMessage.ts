/** Replace `{name}` and legacy `{{name}}` placeholders with vars (value will be `String()`). */
export function formatMessage(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  let out = template
  for (const [k, v] of Object.entries(vars)) {
    const value = String(v)
    out = out.split(`{{${k}}}`).join(value)
    out = out.split(`{${k}}`).join(value)
  }
  return out
}
