'use client';

/** The OpenFrame (Mingo, Fae) drop overlay: covers a composer or a thread while files are dragged over it. */

import type { ReactNode } from 'react';
import type { OpenFrameAttachmentProfile } from '../../chat-protocol/attachment-profiles';

export interface OpenFrameDropOverlayProps {
  /** The product's profile. The default copy no longer reads it; kept so every caller stays the same. */
  profile: OpenFrameAttachmentProfile;
  /** Shown while files are dragged over the zone. */
  visible: boolean;
  /** Overrides the default copy. */
  children?: ReactNode;
}

/** Covers its `relative` zone while files are dragged over it: a dashed accent frame and one line, "Drop files here". */
export function OpenFrameDropOverlay({ visible, children }: OpenFrameDropOverlayProps) {
  if (!visible) return null;
  return (
    <div
      aria-hidden
      data-testid="openframe-drop-overlay"
      className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-[var(--spacing-system-xxs)] rounded-md border border-dashed border-ods-accent bg-ods-bg p-[var(--spacing-system-sf)] text-center"
    >
      {children ?? <span className="text-ods-text-primary text-h4">Drop files here</span>}
    </div>
  );
}
