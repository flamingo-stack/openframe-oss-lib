// Bridges react-router's `navigate` (only callable inside a component) to the
// ChatRuntime's host-mode `navigation.navigate` callback (built once, outside React).
// app-shell sets it on mount; content-runtime calls navigateInApp() for same-origin links.
let navigateFn: ((to: string) => void) | null = null

export function setInAppNavigate(fn: (to: string) => void): void {
  navigateFn = fn
}

/** Returns true when handled in-app (so the lib won't also hit window.location). */
export function navigateInApp(to: string): boolean {
  if (!navigateFn) return false
  navigateFn(to)
  return true
}
