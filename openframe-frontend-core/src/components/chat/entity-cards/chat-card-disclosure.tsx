'use client';

/**
 * What a chat card can open below itself: ONE disclosure, with a KIND per kind of content (`CHAT_CARD_DISCLOSURE`:
 * VIDEO today; IMAGE and the like are one entry each in `CHAT_CARD_DISCLOSURES`). A kind owns everything about its
 * content: the action's words and icon, how to find the content on a fetched record (`fromItem`), and how to draw it.
 *
 * A card shows the kind's action in the footer row it already draws ("Watch video"), and the content opens below
 * the card only when the reader asks for it, so the answer keeps its height while it loads (CU-17tkuw61kfy: the
 * player used to be drawn the moment its card resolved, and an answer with three recordings grew by three players
 * while it was being read). A height change the reader asked for is not a layout shift.
 *
 * It opens and closes like every other expander in the chat (the thinking block, tool calls, approval batches, error
 * details): `ExpandChevron` turns, and `useCollapsible` animates the height. The content mounts on open and unmounts
 * when the close has finished, so a closed player is not playing out of sight.
 *
 * The action's space never changes. A card type whose records can carry a kind's content (`disclosure` on its registry
 * entry, `disclosure: CHAT_CARD_DISCLOSURE.VIDEO`) draws the action in its skeleton (`ChatCardDisclosureButton
 * loading`), and a record of that type without the content keeps the slot, unseen
 * (`useChatCardDisclosure(kind, null, { reserve: true })`).
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

/** The kinds of content a chat card can open below itself. */
export const CHAT_CARD_DISCLOSURE = {
  VIDEO: 'VIDEO',
} as const;

export type ChatCardDisclosureKind = (typeof CHAT_CARD_DISCLOSURE)[keyof typeof CHAT_CARD_DISCLOSURE];

/**
 * The fields of a fetched card record a kind reads. Two shapes: a ChatRef-shaped item (per-object hydration routes)
 * carries `metadata` keys directly; a content row (public list APIs) carries its canonical columns.
 */
export interface ChatCardDisclosureSource {
  metadata?: Record<string, unknown> | null;
  custom_video_url?: string | null;
  main_video_url?: string | null;
  youtube_url?: string | null;
  testimonial_video_url?: string | null;
  highlight_video_url?: string | null;
  main_video_thumbnail?: string | null;
  highlight_video_thumbnail?: string | null;
  featured_image?: string | null;
}

interface ChatCardDisclosureSpec {
  /** The action while the content is closed. */
  label: string;
  /** The action while it is open. */
  openLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  /** This kind's content on a fetched record, as the ref its `render` draws; null when the record has none. */
  fromItem: (item: ChatCardDisclosureSource | undefined, chatRef: ChatRef) => ChatRef | null;
  /** The content, for the ref `fromItem` produced (or a ref that describes it on its own, e.g. a video marker). */
  render: (chatRef: ChatRef) => ReactNode;
}

/** First non-empty string. */
function pick(...values: unknown[]): string | undefined {
  for (const v of values) if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

/**
 * A record's hero video, in the player's metadata keys (`custom_video_url` for recordings, `main_video_url` elsewhere,
 * `testimonial_video_url` is the case-study mapper's youtube column, `featured_image` the customer-interview mapper's
 * poster). Null when the record carries no video.
 */
function videoFromItem(item: ChatCardDisclosureSource | undefined, chatRef: ChatRef): ChatRef | null {
  const m: Record<string, unknown> = item?.metadata ?? {};
  const out: Record<string, string> = {};
  const videoUrl = pick(m.videoUrl, item?.custom_video_url, item?.main_video_url);
  const youtubeUrl = pick(m.youtubeUrl, item?.youtube_url, item?.testimonial_video_url);
  const highlightVideoUrl = pick(m.highlightVideoUrl, item?.highlight_video_url);
  const videoPoster = pick(
    m.videoPoster,
    item?.main_video_thumbnail,
    item?.highlight_video_thumbnail,
    item?.featured_image,
  );
  const highlightVideoPoster = pick(m.highlightVideoPoster, item?.highlight_video_thumbnail);
  if (videoUrl) out.videoUrl = videoUrl;
  if (youtubeUrl) out.youtubeUrl = youtubeUrl;
  if (highlightVideoUrl) out.highlightVideoUrl = highlightVideoUrl;
  if (videoPoster) out.videoPoster = videoPoster;
  if (highlightVideoPoster) out.highlightVideoPoster = highlightVideoPoster;
  if (!out.videoUrl && !out.youtubeUrl && !out.highlightVideoUrl) return null;
  return { ...chatRef, metadata: { ...(chatRef.metadata ?? {}), ...out } };
}

/** Every kind of content a chat card can open. A new kind is one entry here and one in `CHAT_CARD_DISCLOSURE`. */
export const CHAT_CARD_DISCLOSURES: Record<ChatCardDisclosureKind, ChatCardDisclosureSpec> = {
  VIDEO: {
    label: 'Watch video',
    openLabel: 'Hide video',
    icon: PlayIcon,
    fromItem: videoFromItem,
    render: chatRef => <ChatVideoEntityCard chatRef={chatRef} />,
  },
};

/** The first kind whose content a fetched record carries, with that content; null when it carries none. */
export function chatCardDisclosureOf(
  item: ChatCardDisclosureSource | undefined,
  chatRef: ChatRef,
): { kind: ChatCardDisclosureKind; content: ChatRef } | null {
  for (const kind of Object.values(CHAT_CARD_DISCLOSURE)) {
    const content = CHAT_CARD_DISCLOSURES[kind].fromItem(item, chatRef);
    if (content) return { kind, content };
  }
  return null;
}

/** The footer action that opens and closes a kind's content. */
export function ChatCardDisclosureButton({
  kind,
  open = false,
  onToggle,
  title,
  loading,
}: {
  kind: ChatCardDisclosureKind;
  open?: boolean;
  onToggle?: () => void;
  title?: string;
  /** The action's loading form, drawn in the skeleton of a card that can carry this content. */
  loading?: boolean;
}): React.ReactElement {
  const spec = CHAT_CARD_DISCLOSURES[kind];
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
  kind: ChatCardDisclosureKind,
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
          <ChatCardDisclosureButton kind={kind} />
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
    action: <ChatCardDisclosureButton kind={kind} open={open} onToggle={toggle} title={chatRef.title} />,
    panel: mounted ? (
      <div data-testid="chat-card-disclosure-panel" onTransitionEnd={() => !open && setMounted(false)}>
        <DisclosurePanel open={open}>{CHAT_CARD_DISCLOSURES[kind].render(chatRef)}</DisclosurePanel>
      </div>
    ) : null,
  };
}

/** Content with no card of its own: the action on its own row, the panel below it once opened. */
export function ChatCardDisclosureRow({
  kind,
  chatRef,
}: {
  kind: ChatCardDisclosureKind;
  chatRef: ChatRef;
}): React.ReactElement {
  const { action, panel } = useChatCardDisclosure(kind, chatRef);
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
