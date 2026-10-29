'use client';

/**
 * A chat video opens from its card, never on its own.
 *
 * The player used to be drawn the moment its card resolved: a 16:9 box (plus
 * its tab row) appeared under a card whose skeleton was one row tall, and an
 * answer with three recordings grew by three players while it was being read
 * (CU-17tkuw61kfy). Now the card shows a "Watch video" action in the row it
 * already draws, so the answer keeps its height when it loads, and the player
 * opens below the card only when the reader asks for it. A height change the
 * reader asked for is not a layout shift.
 *
 * Two shapes, one state:
 *   - `useChatVideoToggle` for a card with a footer row (the action goes in the
 *     row, the player below the card);
 *   - `ChatCollapsibleVideo` for a video with no card of its own (a
 *     `[card://video:<id>]` marker): the same action on a row of its own.
 *
 * The action's space never changes. A card type whose records can carry a video
 * (`video` on its registry entry) draws the action in its skeleton
 * (`ChatVideoToggleButton loading`), and a record of that type with no video
 * keeps the slot, unseen (`useChatVideoToggle(null, { reserve: true })`), so the
 * row is the same height loading, loaded with a video and loaded without one.
 */

import type React from 'react';
import { type ReactNode, useState } from 'react';
import { PlayIcon } from '../../icons-v2-generated/media-playback/play-icon';
import { Button } from '../../ui/button';
import type { ChatRef } from '../chat-ref.types';
import { CARD_FOOTER_ACTION_CLASS, FooterActionSkeleton } from '../source-action-button';
import { ChatVideoEntityCard } from './chat-video-entity-card';

export const WATCH_VIDEO_LABEL = 'Watch video';
export const HIDE_VIDEO_LABEL = 'Hide video';

export function ChatVideoToggleButton({
  open = false,
  onToggle,
  title,
  loading,
}: {
  open?: boolean;
  onToggle?: () => void;
  title?: string;
  /** The action's loading form, drawn in the skeleton of a card that can carry a video. */
  loading?: boolean;
}): React.ReactElement {
  if (loading) return <FooterActionSkeleton label={WATCH_VIDEO_LABEL} className={CARD_FOOTER_ACTION_CLASS} />;
  const label = open ? HIDE_VIDEO_LABEL : WATCH_VIDEO_LABEL;
  return (
    <Button
      variant="transparent"
      size="small"
      leftIcon={<PlayIcon className="!h-3 !w-3" />}
      onClick={(e: React.MouseEvent) => {
        // The card around it is a link: the action must not follow it.
        e.preventDefault();
        e.stopPropagation();
        onToggle?.();
      }}
      aria-expanded={open}
      aria-label={title ? `${label}: ${title}` : label}
      className={CARD_FOOTER_ACTION_CLASS}
    >
      {label}
    </Button>
  );
}

/**
 * The action for a card's footer row, and the player to draw below the card (null while closed). With no video,
 * `reserve` keeps the action's slot, unseen and unreachable, for a card type whose records can carry one.
 */
export function useChatVideoToggle(
  video: ChatRef | null,
  { reserve = false }: { reserve?: boolean } = {},
): { action: ReactNode; player: ReactNode } {
  const [open, setOpen] = useState(false);
  if (!video) {
    return {
      action: reserve ? (
        <span aria-hidden inert className="invisible">
          <ChatVideoToggleButton />
        </span>
      ) : null,
      player: null,
    };
  }
  return {
    action: <ChatVideoToggleButton open={open} onToggle={() => setOpen(o => !o)} title={video.title} />,
    player: open ? <ChatVideoEntityCard chatRef={video} /> : null,
  };
}

/** A video with no card of its own: the action on its own row, the player below it once opened. */
export function ChatCollapsibleVideo({ chatRef }: { chatRef: ChatRef }): React.ReactElement {
  const { action, player } = useChatVideoToggle(chatRef);
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <div className="flex items-center gap-2 pl-0.5">
        {action}
        <span className="min-w-0 truncate text-ods-text-secondary text-h6">{chatRef.title}</span>
      </div>
      {player}
    </div>
  );
}
