'use client';

/**
 * The OpenFrame (Mingo, Fae) composer's tray of staged files. Presentational: the host (or the uploader) owns the items
 * and their states. Guide mode's chips (`chat-attachment-bar.tsx`) are separate and untouched.
 */

import type {
  OpenFrameAttachmentItem,
  OpenFrameAttachmentProfile,
  OpenFrameAttachmentTrayPlacement,
} from '../../chat-protocol/attachment-profiles';
import { cn } from '../../utils/cn';
import { OpenFrameAttachmentTile } from './openframe-attachment-tile';

export interface OpenFrameAttachmentTrayProps {
  items: readonly OpenFrameAttachmentItem[];
  profile: OpenFrameAttachmentProfile;
  onRemove: (id: string) => void;
  /** Defaults to the profile's. */
  placement?: OpenFrameAttachmentTrayPlacement;
  className?: string;
}

/**
 * The staged files. `below` (Mingo): under the input row, tiles wrap, indented to the text after the `+`. `above`
 * (Fae): over the input row in one row that scrolls sideways, fading out at the right edge. Nothing when empty.
 */
export function OpenFrameAttachmentTray({
  items,
  profile,
  onRemove,
  placement,
  className,
}: OpenFrameAttachmentTrayProps) {
  if (items.length === 0) return null;
  const where = placement ?? profile.trayPlacement;
  const list = (
    <ul
      aria-label="Attached files"
      data-placement={where}
      className={cn(
        'm-0 flex list-none gap-[var(--spacing-system-xsf)] p-0',
        where === 'below'
          ? 'flex-wrap pb-[var(--spacing-system-sf)] pl-[var(--spacing-system-xlf)] pr-[var(--spacing-system-sf)]'
          : 'overflow-x-auto p-[var(--spacing-system-xsf)] pr-[var(--spacing-system-xlf)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      )}
    >
      {items.map(item => (
        <li key={item.id} className="shrink-0">
          <OpenFrameAttachmentTile item={item} profile={profile} onRemove={onRemove} />
        </li>
      ))}
    </ul>
  );
  if (where === 'below') return <div className={className}>{list}</div>;
  return (
    <div className={cn('relative border-b border-ods-border', className)}>
      {list}
      {/* Figma `scroll-gradient`: the row runs on under the fade. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-ods-card to-transparent"
      />
    </div>
  );
}
