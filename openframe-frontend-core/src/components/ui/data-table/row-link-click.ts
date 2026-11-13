import type React from 'react';
import { isOwnClick } from '../../../utils/own-click';

/** A control inside a row link whose click is its own: it never follows the row's link. */
const ROW_LINK_CONTROL_SELECTOR = 'button, [role="button"]';

/**
 * A click inside a row link that is a control's, not the link's: in a `data-no-row-click` element or on a button.
 * Left alone: a portalled descendant's click (its target is outside the anchor, so the anchor has no default action)
 * and a link nested in a cell (the innermost link is the one the browser follows).
 */
export function isRowLinkControlClick(target: EventTarget | null, container: Element | null): boolean {
  if (!(target instanceof Element) || !container?.contains(target)) return false;
  const nestedLink = target.closest('a');
  if (nestedLink && nestedLink !== container && container.contains(nestedLink)) return false;
  return !isOwnClick(target, container) || target.closest(ROW_LINK_CONTROL_SELECTOR) !== null;
}

/**
 * Cancels a control's click in a row link so the link does not navigate, AFTER every React handler has seen it, from
 * the capture phase. The row's bubble handler cannot cancel it alone: a control that calls `stopPropagation` (or sits
 * in a wrapper that does) keeps the click from ever reaching it, and the browser then follows the anchor (an Edit
 * button opened its modal, then the row's page). Cancelling in the capture phase itself is worse: Radix composes every
 * trigger's handler to skip its own toggle on a cancelled event, so every popover trigger in a row link stayed shut.
 *
 * So the cancel is a listener on React's root (the node every React handler runs from, the native event's
 * `currentTarget` during the capture phase), added after React's own: it runs last, and `stopPropagation` does not
 * stop a listener on the node the event is already at.
 */
export function cancelAfterReactHandlers(event: React.SyntheticEvent): void {
  const native = event.nativeEvent;
  native.currentTarget?.addEventListener(
    native.type,
    late => {
      if (late === native) late.preventDefault();
    },
    { once: true },
  );
}
