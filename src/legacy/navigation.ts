function blocked(): never {
  throw new Error('[NAV FIREWALL] legacy module access blocked')
}

export function openNote(): never {
  return blocked()
}

export function openInTab(): never {
  return blocked()
}

export function dispatchKnowledgeNavigate(): never {
  return blocked()
}

export function kernelExecutorNavigate(): never {
  return blocked()
}
