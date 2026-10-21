'use client';

import { cn } from '../../utils/cn';
import { LoadingRegion } from '../loading/loading-region';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { SquareAvatarSkeleton } from '../ui/square-avatar';
import { useChatAppearance } from './chat-appearance-context';
import {
  CHAT_MESSAGE_FACE_PX,
  CHAT_MESSAGE_HEADER_CLASS,
  CHAT_MESSAGE_ROW_PADDING_CLASS,
  CHAT_MESSAGE_SEGMENTS_CLASS,
  CHAT_MESSAGE_STACK_CLASS,
  CHAT_MESSAGE_TEXT_CLASS,
  CHAT_MESSAGE_USER_BUBBLE_CLASS,
  CHAT_MESSAGE_USER_ROW_CLASS,
} from './chat-message-layout';
import type { ChatAppearance } from './types/chat.types';

interface ChatMessageSkeletonProps {
  className?: string;
  /** Whether the row draws its speaker's face, as `ChatMessageEnhanced`'s `showAvatar` (default true). */
  showAvatar?: boolean;
  /** The user's own turn: the face at the right and the message as the right-side bubble. */
  isUser?: boolean;
  /**
   * Whether the face line carries a name and a time, as the loaded row writes them only for a system line and
   * another person answering (default false: the user's and the agent's turns show a face only).
   */
  showName?: boolean;
  /** How many lines the message takes. Default 3 (a paragraph); 1 for single-line surfaces. */
  bodyLines?: number;
  /** The thread's appearance (its row padding); the surrounding chat's when not given. */
  appearance?: ChatAppearance;
  /** One message of a read thread (`data-loading-item`): set by the list skeleton, like the loaded rows. */
  listItem?: boolean;
}

/**
 * One message row while it is read: `ChatMessageEnhanced`'s own layout from its own class constants (the row's
 * padding per appearance, the face line, the segments), the face a 20px round box, and the message as text-h4 lines
 * (a bubble at the right for the user's own turn, plain text across the width for anyone else).
 */
export function ChatMessageSkeleton({
  className,
  showAvatar = true,
  isUser = false,
  showName = false,
  bodyLines = 3,
  appearance: appearanceProp,
  listItem = false,
}: ChatMessageSkeletonProps) {
  const inherited = useChatAppearance();
  const appearance = appearanceProp ?? inherited;
  const lines = Math.max(1, bodyLines);
  return (
    <div
      className={cn('relative', CHAT_MESSAGE_ROW_PADDING_CLASS[appearance], className)}
      {...(listItem ? { 'data-loading-item': '' } : undefined)}
    >
      <div className={CHAT_MESSAGE_STACK_CLASS}>
        {(showAvatar || showName) && (
          <div className={cn(CHAT_MESSAGE_HEADER_CLASS, isUser && 'justify-end')}>
            {showAvatar && <SquareAvatarSkeleton sizePx={CHAT_MESSAGE_FACE_PX} variant="round" />}
            {showName && <TextLineSkeleton type="h6" className="w-24" />}
            {showName && <TextLineSkeleton type="h6" className="ml-auto w-14 shrink-0" />}
          </div>
        )}
        <div className={CHAT_MESSAGE_SEGMENTS_CLASS}>
          {isUser ? (
            <div className={CHAT_MESSAGE_USER_ROW_CLASS}>
              <div className={cn(CHAT_MESSAGE_USER_BUBBLE_CLASS, 'w-1/2')}>
                <TextLineSkeleton type="h4" lines={lines} />
              </div>
            </div>
          ) : (
            <div className={CHAT_MESSAGE_TEXT_CLASS}>
              <TextLineSkeleton type="h4" lines={lines} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Message rows a thread's skeleton draws: a typical thread, since a thread loads with no page size of its own. */
export const CHAT_MESSAGE_LIST_SKELETON_MESSAGES = 6;

interface ChatMessageListSkeletonProps {
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
  className?: string;
  messageCount?: number;
  showAvatars?: boolean;
  /**
   * Match `ChatMessageList`'s `fullWidth`: drop the centered
   * `max-w-ods-content-narrow` column so the skeleton fills the panel and
   * reflows on resize (instead of staying a fixed narrow column with large
   * side gutters). Same semantics as the real list.
   */
  fullWidth?: boolean;
  /** Extra classes on the content column (e.g. host-provided padding). The
   *  host wrapper is expected to own the panel padding; this stays empty by
   *  default so the skeleton sits flush. */
  contentClassName?: string;
  /** Body lines per message row (forwarded to `ChatMessageSkeleton`). Default 3;
   *  pass 1 for single-line message surfaces. */
  bodyLines?: number;
  /**
   * FILL mode: top-anchor the rows and CLIP overflow (instead of bottom-anchoring
   * + inner scroll). Combined with a generous `messageCount`, the rows cover the
   * container top-to-bottom at ANY height — no per-container measuring, no empty
   * band at the top. Use for loading surfaces that should read as "the whole
   * panel is loading" rather than "a short thread pinned to the bottom".
   */
  fill?: boolean;
  /** The thread's appearance (its rows' padding), as `ChatMessageList`'s; the surrounding chat's when not given. */
  appearance?: ChatAppearance;
}

export function ChatMessageListSkeleton({
  region = true,
  className,
  messageCount = CHAT_MESSAGE_LIST_SKELETON_MESSAGES,
  showAvatars = true,
  fullWidth = false,
  contentClassName,
  bodyLines,
  fill = false,
  appearance,
}: ChatMessageListSkeletonProps) {
  const messages = Array.from({ length: messageCount }, (_, index) => ({
    id: index,
    isUser: index % 3 === 0,
  }));

  return (
    <LoadingRegion label="Loading messages" announce={region} className="relative flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          'flex h-full w-full flex-1 flex-col',
          fill
            ? 'overflow-hidden'
            : 'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-ods-border/30 hover:scrollbar-thumb-ods-text-secondary/30 overflow-y-auto overflow-x-hidden overscroll-contain [scroll-behavior:smooth]',
          className,
        )}
      >
        <div
          className={cn(
            fullWidth
              ? 'flex w-full min-w-0 flex-col'
              : 'mx-auto flex w-full min-w-0 max-w-ods-content-narrow flex-col',
            contentClassName,
          )}
          style={fill ? undefined : { minHeight: '100%' }}
        >
          {/* Bottom-anchor the rows like the real list — unless FILL mode wants
              them top-anchored + clipped to cover the whole panel. */}
          {!fill && <div className="flex-1" />}
          {messages.map(message => (
            <ChatMessageSkeleton
              key={message.id}
              showAvatar={showAvatars}
              isUser={message.isUser}
              // The user's own turns are short: one line in the bubble, unless the surface states its line count.
              bodyLines={message.isUser ? (bodyLines ?? 1) : bodyLines}
              appearance={appearance}
              listItem
            />
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}
