'use client';

import { useIsTruncated } from './use-is-truncated';
import { useMediaQuery } from './use-media-query';

/** A pointer that can hover: where a tooltip on a clipped label is reachable. A touch screen has none. */
export const HOVER_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';

/**
 * A clipped label's "full text" tooltip: `ref` goes on the clipped element (see
 * {@link useIsTruncated}), `enabled` says whether the tooltip may open — only
 * while the text IS clipped, and only on a device whose pointer can hover. A
 * phone or tablet has no hover to reach it with, so it offers none there; the
 * rows keep their accessible names. Pass the rendered text as `value`.
 */
export function useClippedLabelTooltip<T extends HTMLElement>(value: unknown) {
  const { ref, isTruncated } = useIsTruncated<T>(value);
  const canHover = useMediaQuery(HOVER_MEDIA_QUERY) === true;
  return { ref, enabled: isTruncated && canHover };
}
