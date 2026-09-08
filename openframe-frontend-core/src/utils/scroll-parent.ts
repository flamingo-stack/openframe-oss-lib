/** Anything the browser can scroll. */
const SCROLLABLE = /(auto|scroll|overlay)/;

/** Every scrollable ancestor of `element`, innermost first. */
export function scrollableAncestorsOf(element: HTMLElement): HTMLElement[] {
  const found: HTMLElement[] = [];
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (SCROLLABLE.test(style.overflowY) || SCROLLABLE.test(style.overflowX)) found.push(node);
  }
  return found;
}

/**
 * The nearest scrollable ancestor, or `null`.
 *
 * Stands in for "the working area this thing lives in": in an app whose layout
 * scrolls a `<main>` rather than the document, that element is exactly the
 * region a user considers to be the page.
 */
export function nearestScrollableAncestor(element: HTMLElement): HTMLElement | null {
  return scrollableAncestorsOf(element)[0] ?? null;
}
