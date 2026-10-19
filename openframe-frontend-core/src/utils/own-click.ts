/**
 * THE click-bubbling rule of a clickable container (a table row, a pickable
 * card): a click is the container's own unless
 *  - its target is not physically inside the container (a click in a portalled
 *    descendant, a tooltip or a dropdown, bubbles through React's tree only), or
 *  - it lands inside an element marked `data-no-row-click`, or
 *  - with `controls`, it lands on another control or link inside the container,
 *    which does its own thing.
 */
const NO_ROW_CLICK_SELECTOR = '[data-no-row-click]';
const CONTROL_SELECTOR = 'a, button, input, select, textarea, label, [role="button"], [role="link"]';

export function isOwnClick(
  target: EventTarget | null,
  container: Element | null,
  { controls = false }: { controls?: boolean } = {},
): boolean {
  if (!(target instanceof Element) || !container?.contains(target)) return false;
  if (target.closest(NO_ROW_CLICK_SELECTOR)) return false;
  if (controls) {
    const control = target.closest(CONTROL_SELECTOR);
    if (control && control !== container && container.contains(control)) return false;
  }
  return true;
}
