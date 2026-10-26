/**
 * Run `run` once the page has loaded and the browser is idle: the moment for work no visitor waits on (a widget
 * that starts closed, a tracker). Whatever runs before then competes with the page's first paint and hydration, which
 * is what slows a phone's Largest Contentful Paint. `maxWaitMs` bounds the idle wait, so a page that is never idle
 * still gets it. Returns a cancel.
 */
export function afterPageLoad(run: () => void, maxWaitMs = 2000): () => void {
  if (typeof window === 'undefined') return () => {};
  type IdleWindow = Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  const w = window as IdleWindow;
  let idleHandle: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;
  const whenIdle = () => {
    if (cancelled) return;
    if (typeof w.requestIdleCallback === 'function') idleHandle = w.requestIdleCallback(run, { timeout: maxWaitMs });
    else timer = setTimeout(run, 0);
  };
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener('load', whenIdle);
    if (idleHandle !== null) w.cancelIdleCallback?.(idleHandle);
    if (timer !== null) clearTimeout(timer);
  };
}
