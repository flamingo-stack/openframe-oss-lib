'use client';

/**
 * What a chat card can open below itself: ONE disclosure, with a variant per kind of content (`CHAT_CARD_DISCLOSURES`).
 *
 * A card shows the variant's action in the footer row it already draws ("Watch video"), and the content opens below
 * the card only when the reader asks for it, so the answer keeps its height while it loads (CU-17tkuw61kfy: the
 * player used to be drawn the moment its card resolved, and an answer with three recordings grew by three players
 * while it was being read). A height change the reader asked for is not a layout shift.
 *
 * It opens and closes like every other expander in the chat (the thinking block, tool calls, approval batches, error
 * details): `ExpandChevron` turns, and `useCollapsible` animates the height. The content mounts on open and unmounts
 * when the close has finished, so a closed player is not playing out of sight.
 *
 * The action's space never changes. A card type whose records can carry a variant's content (`video` on its registry
 * entry) draws the action in its skeleton (`ChatCardDisclosureButton loading`), and a record of that type without
 * the content keeps the slot, unseen (`useChatCardDisclosure(variant, null, { reserve: true })`).
 *
 * Two shapes, one state:
 *   - `useChatCardDisclosure` for a card with a footer row (the action goes in the row, the panel below the card);
 *   - `ChatCardDisclosureRow` for content with no card of its own (a `[card://video:<id>]` marker): the same action on
 *     a row of its own.
 */

import type React from 'react';
import { type ReactNode, useState } from 'react';
import { PlayIcon } from '../../icons-v2-generated/media-playback/play-icon';
import { Button } from '../../ui/button';
import type { ChatRef } from '../chat-ref.types';
import { ExpandChevron } from '../expand-chevron';
import { useCollapsible } from '../hooks/use-collapsible';
import { CARD_FOOTER_ACTION_CLASS, FooterActionSkeleton } from '../source-action-button';
import { ChatVideoEntityCard } from './chat-video-entity-card';

interface ChatCardDisclosureSpec {
  /** The action while the content is closed. */
  label: string;
  /** The action while it is open. */
  openLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  /** The content, for the record the card shows. */
  render: (chatRef: ChatRef) => ReactNode;
}

/** Every kind of content a chat card can open. A new kind is one entry here. */
export const CHAT_CARD_DISCLOSURES = {
  video: {
    label: 'Watch video',
    openLabel: 'Hide video',
    icon: PlayIcon,
    render: chatRef => <ChatVideoEntityCard chatRef={chatRef} />,
  },
} satisfies Record<string, ChatCardDisclosureSpec>;

export type ChatCardDisclosureVariant = keyof typeof CHAT_CARD_DISCLOSURES;

/** The footer action that opens and closes a variant's content. */
export function ChatCardDisclosureButton({
  variant,
  open = false,
  onToggle,
  title,
  loading,
}: {
  variant: ChatCardDisclosureVariant;
  open?: boolean;
  onToggle?: () => void;
  title?: string;
  /** The action's loading form, drawn in the skeleton of a card that can carry this content. */
  loading?: boolean;
}): React.ReactElement {
  const spec = CHAT_CARD_DISCLOSURES[variant];
  if (loading) return <FooterActionSkeleton label={spec.label} className={CARD_FOOTER_ACTION_CLASS} />;
  const label = open ? spec.openLabel : spec.label;
  const Icon = spec.icon;
  return (
    <Button
      variant="transparent"
      size="small"
      leftIcon={<Icon className="!h-3 !w-3" />}
      rightIcon={<ExpandChevron expanded={open} className="!h-3 !w-3" />}
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

/** The panel below the card: animated like every chat expander, its content mounted only while open or closing. */
function DisclosurePanel({ open, children }: { open: boolean; children: ReactNode }): React.ReactElement {
  const { innerRef, containerStyle } = useCollapsible({ expanded: open });
  return (
    <div style={containerStyle}>
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

/**
 * The action for a card's footer row, and the panel to draw below the card. With no content (`chatRef` null),
 * `reserve` keeps the action's slot, unseen and unreachable, for a card type whose records can carry it.
 */
export function useChatCardDisclosure(
  variant: ChatCardDisclosureVariant,
  chatRef: ChatRef | null,
  { reserve = false }: { reserve?: boolean } = {},
): { action: ReactNode; panel: ReactNode } {
  const [open, setOpen] = useState(false);
  // Mounted from the first open until a close has finished animating.
  const [mounted, setMounted] = useState(false);
  if (!chatRef) {
    return {
      action: reserve ? (
        <span aria-hidden inert className="invisible">
          <ChatCardDisclosureButton variant={variant} />
        </span>
      ) : null,
      panel: null,
    };
  }
  const toggle = () => {
    if (!open) setMounted(true);
    setOpen(o => !o);
  };
  return {
    action: <ChatCardDisclosureButton variant={variant} open={open} onToggle={toggle} title={chatRef.title} />,
    panel: mounted ? (
      <div data-testid="chat-card-disclosure-panel" onTransitionEnd={() => !open && setMounted(false)}>
        <DisclosurePanel open={open}>{CHAT_CARD_DISCLOSURES[variant].render(chatRef)}</DisclosurePanel>
      </div>
    ) : null,
  };
}

/** Content with no card of its own: the action on its own row, the panel below it once opened. */
export function ChatCardDisclosureRow({
  variant,
  chatRef,
}: {
  variant: ChatCardDisclosureVariant;
  chatRef: ChatRef;
}): React.ReactElement {
  const { action, panel } = useChatCardDisclosure(variant, chatRef);
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <div className="flex items-center gap-2 pl-0.5">
        {action}
        <span className="min-w-0 truncate text-ods-text-secondary text-h6">{chatRef.title}</span>
      </div>
      {panel}
    </div>
  );
}
