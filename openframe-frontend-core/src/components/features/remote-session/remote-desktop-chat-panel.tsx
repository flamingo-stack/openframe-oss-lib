'use client';

import { useEffect, useRef } from 'react';
import { cn } from '../../../utils/cn';
import { ChatInput } from '../../chat/chat-input';
import { LoadingRegion } from '../../loading/loading-region';
import { useLoadingScope } from '../../ui/loading-scope';
import { RemoteDesktopChatMessageRow } from './remote-desktop-chat-message-row';
import type { RemoteSessionChatMessage } from './types';

/**
 * Message rows the panel's loading state draws: a typical count. The panel draws the whole history its host hands it
 * (no page, no limit), so there is no page size to draw.
 */
const CHAT_PANEL_SKELETON_ROWS = 10;

/** Who is typing on the technician's side of the chat: shown on the technician's rows. */
export interface RemoteDesktopChatTechnician {
  name: string;
  avatarUrl?: string;
}

/** The end user has no profile on the wire: their rows read "User" unless a row names them. */
export const REMOTE_DESKTOP_CHAT_END_USER_NAME = 'User';

export interface RemoteDesktopChatPanelProps {
  messages: RemoteSessionChatMessage[];
  /** The dialog's history is still on its way; the empty state must not claim there is nothing. */
  loading?: boolean;
  technician: RemoteDesktopChatTechnician;
  sending: boolean;
  /** Resolves `false` to keep the draft in the input (nothing was sent). */
  onSend: (body: string) => Promise<boolean>;
  /**
   * `side` - the right-hand column next to the screen;
   * `overlay` - floating over the stream in fullscreen, positioned against
   * the fullscreen screen container.
   */
  variant: 'side' | 'overlay';
}

/**
 * The technician's chat with the end user during a remote session: the message
 * stream bottom-aligned above the composer. The end user's side is
 * `RemoteSessionChatPanel` in the session block; the "joined the chat" notice
 * is that side's indication only and is not shown here.
 */
export function RemoteDesktopChatPanel({
  messages,
  loading: loadingProp,
  technician,
  sending,
  onSend,
  variant,
}: RemoteDesktopChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // System notices (the "joined the chat" line) are the end user's indication only.
  const rows = messages.filter(message => message.author !== 'system');
  // ONE switch: in a page's loading state (or while the host reads a history it has none of yet) the stream is its
  // skeleton.
  const loading = useLoadingScope() || (rows.length === 0 && !!loadingProp);

  // Keep the newest message in view as the stream grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rows.length]);

  return (
    <aside
      aria-label="Session chat"
      className={cn(
        'flex flex-col gap-[var(--spacing-system-mf)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)]',
        variant === 'side'
          ? 'h-full w-[400px] flex-shrink-0'
          : 'absolute bottom-[var(--spacing-system-mf)] right-[var(--spacing-system-mf)] top-[calc(var(--spacing-system-xlf)+var(--spacing-system-mf))] z-10 w-[360px] shadow-lg',
      )}
    >
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col justify-end gap-[var(--spacing-system-xsf)]">
          {loading ? (
            // The chat while it is read: a screen of the panel's own message rows, stacked by a one-column grid
            // (the thread above is already the column flexbox: WEBVIEW-001).
            <LoadingRegion label="Loading the chat" className="grid grid-cols-1 gap-[var(--spacing-system-xsf)]">
              {Array.from({ length: CHAT_PANEL_SKELETON_ROWS }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows never reorder
                // A conversation: the technician and the user take turns.
                <RemoteDesktopChatMessageRow
                  key={i}
                  loading
                  isTechnician={i % 2 === 1}
                  authorName=""
                  sentAt=""
                  body=""
                />
              ))}
            </LoadingRegion>
          ) : rows.length === 0 ? (
            <p className="text-center text-ods-text-muted text-h6">No messages yet - say hello to the user.</p>
          ) : (
            rows.map(message => (
              <RemoteDesktopChatMessageRow
                key={message.id}
                authorName={
                  message.name ||
                  (message.author === 'technician' ? technician.name : REMOTE_DESKTOP_CHAT_END_USER_NAME)
                }
                isTechnician={message.author === 'technician'}
                avatarUrl={message.author === 'technician' ? technician.avatarUrl : undefined}
                sentAt={message.at}
                body={message.text}
              />
            ))
          )}
        </div>
      </div>

      <ChatInput
        placeholder="Enter your Message..."
        onSend={onSend}
        sending={sending}
        showSendButton
        fullWidth
        maxRows={4}
      />
    </aside>
  );
}
