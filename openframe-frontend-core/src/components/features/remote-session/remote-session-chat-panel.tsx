'use client';

import { useEffect, useRef } from 'react';
import { cn } from '../../../utils/cn';
import { MessageOffIcon, Send03Icon } from '../../icons-v2-generated';
import { Button } from '../../ui/button/button';
import { SquareAvatar } from '../../ui/square-avatar';
import { RemoteSessionEndButton } from './remote-session-block';
import { REMOTE_SESSION_DRAG_HANDLE_CLASS, RemoteSessionDragger, RemoteSessionStatusRow } from './remote-session-parts';
import type {
  RemoteSessionChatMessage,
  RemoteSessionDragHandlers,
  RemoteSessionParty,
  RemoteSessionViewer,
} from './types';

export interface RemoteSessionChatPanelProps {
  party: RemoteSessionParty;
  /** Elapsed session time, e.g. from `useRemoteSessionTimer`. */
  elapsed: string;
  messages: RemoteSessionChatMessage[];
  showRecordingTag?: boolean;
  /** Everyone in the session while colleagues watch it, the host included; hidden when empty. */
  viewers?: RemoteSessionViewer[];
  /** The composer's text; owned by the host so it survives hiding the block. */
  draft: string;
  onDraftChange: (draft: string) => void;
  /** Called with the trimmed text; the composer clears itself through `onDraftChange`. */
  onSend: (text: string) => void;
  /** False while the chat is still connecting: the composer is disabled. */
  ready?: boolean;
  error?: string | null;
  onCloseChat: () => void;
  onEndSession: () => void;
  /** Makes the header and the dragger move the window. */
  dragHandlers?: RemoteSessionDragHandlers;
}

function formatTime(at: Date): string {
  return at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** The chat with the technician inside the session block. */
export function RemoteSessionChatPanel({
  party,
  elapsed,
  messages,
  showRecordingTag = false,
  viewers,
  draft,
  onDraftChange,
  onSend,
  ready = true,
  error,
  onCloseChat,
  onEndSession,
  dragHandlers,
}: RemoteSessionChatPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // The list is the trigger: the newest row must come into view on every change.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    onDraftChange('');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex flex-col gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]">
        <RemoteSessionDragger dragHandlers={dragHandlers} />
        <div
          className={cn(
            'flex w-full flex-col pr-[var(--spacing-system-mf)]',
            dragHandlers && REMOTE_SESSION_DRAG_HANDLE_CLASS,
          )}
          {...dragHandlers}
        >
          <p className="w-full truncate text-ods-text-primary text-h4">
            Your IT support team is connected <span className="text-ods-text-secondary">({elapsed})</span>
          </p>
          <p className="w-full truncate text-ods-text-secondary text-h4">You can end this session at any time</p>
        </div>
        <RemoteSessionStatusRow showRecordingTag={showRecordingTag} viewers={viewers} />
        <div className="flex w-full items-stretch gap-[var(--spacing-system-m)]">
          <Button
            variant="outline"
            fullWidth
            leftIcon={<MessageOffIcon size={24} color="currentColor" />}
            onClick={onCloseChat}
          >
            Close Chat
          </Button>
          <RemoteSessionEndButton onEndSession={onEndSession} />
        </div>
      </div>
      <div
        ref={listRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-ods-card p-[var(--spacing-system-m)]"
      >
        {/* mt-auto (not justify-end) keeps the top of an overflowing list scrollable. */}
        <div className="mt-auto flex flex-col gap-[var(--spacing-system-s)]">
          {messages.map(message =>
            message.author === 'system' ? (
              <p key={message.id} className="w-full text-center text-ods-text-secondary text-h6">
                {message.text}
              </p>
            ) : (
              <RemoteSessionChatMessageRow key={message.id} message={message} party={party} />
            ),
          )}
        </div>
      </div>
      {error && <p className="bg-ods-card px-[var(--spacing-system-m)] text-ods-error text-h6">{error}</p>}
      <form
        className="flex items-center gap-[var(--spacing-system-xs)] bg-ods-card px-[var(--spacing-system-m)] pb-[var(--spacing-system-m)]"
        onSubmit={event => {
          event.preventDefault();
          handleSend();
        }}
      >
        <input
          value={draft}
          onChange={event => onDraftChange(event.target.value)}
          disabled={!ready}
          placeholder={ready ? 'Enter your Message...' : 'Loading chat...'}
          aria-label="Message"
          className="h-12 min-w-0 flex-1 rounded-md border border-ods-border bg-ods-bg px-[var(--spacing-system-s)] text-ods-text-primary outline-none text-h6 placeholder:text-ods-text-secondary"
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={!ready}
          className="flex size-12 shrink-0 items-center justify-center"
        >
          <Send03Icon size={24} color="currentColor" className="text-ods-text-primary" />
        </button>
      </form>
    </div>
  );
}

function RemoteSessionChatMessageRow({
  message,
  party,
}: {
  message: RemoteSessionChatMessage;
  party: RemoteSessionParty;
}) {
  const isTechnician = message.author === 'technician';
  const technician = message.name ?? party.technicianName ?? 'Technician';
  return (
    <div className="flex w-full flex-col">
      <div className="flex w-full items-center gap-[var(--spacing-system-xs)]">
        {isTechnician && (
          <SquareAvatar
            variant="round"
            sizePx={16}
            src={party.technicianAvatarUrl ?? undefined}
            fallback={technician}
          />
        )}
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-code',
            isTechnician ? 'text-ods-accent' : 'text-ods-text-secondary',
          )}
        >
          {isTechnician ? technician : 'User'}
        </span>
        <span className="shrink-0 text-ods-text-secondary text-h6">{formatTime(message.at)}</span>
      </div>
      <p className="w-full break-words text-ods-text-primary text-h6">{message.text}</p>
    </div>
  );
}
