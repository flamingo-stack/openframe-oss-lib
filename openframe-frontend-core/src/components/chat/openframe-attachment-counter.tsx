'use client';

/** The OpenFrame (Mingo, Fae) composer's file counter, in the input row before Send. */

import type { OpenFrameTraySummary } from './utils/openframe-attachment-view';

/** "2/10 · 5/20 in chat", in the input row before Send. */
export function OpenFrameAttachmentCounter({ summary }: { summary: OpenFrameTraySummary }) {
  return (
    <span
      data-testid="openframe-attachment-counter"
      className="shrink-0 whitespace-nowrap text-ods-text-secondary text-h6"
    >
      {summary.counter}
    </span>
  );
}
